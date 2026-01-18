from flask import Flask, request, jsonify, session 
from .prompts import PromptManager, Prompt
from .tracker import Tracker, EventType, ReportGenerator
import webbrowser
import threading
import time
import httpx 
from openai import OpenAI 
from . import memory_manager 
import os 
import logging 
from .user_settings import settings_store
from flask_cors import CORS

# Tool system imports
from .tools import (
    PermissionStore, ControlLayer, ActivityLogger,
    MemoryTool, FileTool, WebTool, PermissionLevel, ToolAction
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, supports_credentials=True, origins=["http://localhost:3000"]) # Enable CORS with specific origin for credentials
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'super_secret_key') # Use environment variable for secret key
manager = PromptManager()
tracker = Tracker() # Initialize the Tracker

# Initialize Ollama client
custom_http_client = httpx.Client(base_url='http://localhost:11434/v1')
ollama_client = OpenAI(base_url='http://localhost:11434/v1', api_key='ollama', http_client=custom_http_client) # Pass the custom client

# Initialize tool system
permission_store = PermissionStore()
activity_logger = ActivityLogger()

def on_tool_notify(action: ToolAction, result):
    """Callback when a NOTIFY-level tool is executed."""
    activity_logger.log_tool_result(action, result)

def on_tool_pending(pending):
    """Callback when a tool action is queued for approval."""
    activity_logger.log_pending(pending.action)

control_layer = ControlLayer(
    permission_store=permission_store,
    on_notify=on_tool_notify,
    on_pending=on_tool_pending
)

# Register tools
control_layer.register_tool(MemoryTool())
control_layer.register_tool(FileTool(allowed_paths=["."]))
control_layer.register_tool(WebTool())

# Wire LLM Service to the tool system
from .llm_interactions import llm_service
llm_service.control_layer = control_layer
llm_service.activity_logger = activity_logger

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user_id = data.get('user_id')
    if not user_id:
        return jsonify(success=False, message="User ID is required"), 400
    session['user_id'] = user_id
    logger.info(f"User '{user_id}' logged in via API.")
    return jsonify(success=True, user_id=user_id)

@app.route('/logout', methods=['POST'])
def logout():
    user_id = session.pop('user_id', None)
    logger.info(f"User '{user_id}' logged out via API.")
    return jsonify(success=True)

@app.route('/api/me')
def me():
    user_id = session.get('user_id', 'anonymous')
    return jsonify(user_id=user_id)

@app.route('/')
def index():
    user_id = session.get('user_id', 'anonymous') 
    logger.info(f"User '{user_id}' accessed API index.")
    search_query = request.args.get('query')
    if search_query:
        prompts = manager.search_prompts(search_query)
        logger.info(f"User '{user_id}' searched for '{search_query}'.")
    else:
        prompts = manager.list_prompts()
        logger.info(f"User '{user_id}' listed all prompts.")

    prompts_list = [p.to_dict() for p in prompts]
    return jsonify(prompts_list)

@app.route('/add_prompt', methods=['POST'])
def add_prompt():
    user_id = session.get('user_id', 'anonymous')
    data = request.json
    name = data.get('name')
    content = data.get('content')
    category = data.get('category', 'Uncategorized')
    tags_str = data.get('tags', '')
    tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]

    try:
        prompt = Prompt(name, content, category, tags)
        manager.add_prompt(prompt)
        tracker.record_web_action(user_id, EventType.PROMPT_ADD_ACTION, {"prompt_name": name, "prompt_content": content, "category": category, "tags": tags})
        logger.info(f"User '{user_id}' added prompt '{name}'.")
        return jsonify(success=True, message=f"Prompt '{name}' added successfully."), 200
    except ValueError as e:
        logger.error(f"User '{user_id}' failed to add prompt: {e}")
        return jsonify(success=False, message=str(e)), 400

@app.route('/ollama_models')
def ollama_models():
    try:
        models = ollama_client.models.list()
        model_names = [{'model': m.id, 'name': m.id} for m in models.data]
        logger.info("Ollama models listed successfully.")
        return jsonify(models=model_names)
    except Exception as e:
        logger.error(f"Error listing Ollama models: {e}")
        return jsonify(error=str(e)), 500

@app.route('/generate_text', methods=['POST'])
def generate_text():
    data = request.json
    model_name = data.get('model')
    prompt_text = data.get('prompt')
    system_prompt = data.get('system_prompt')
    chat_messages = data.get('messages', [])
    session_id = data.get('session_id')

    if not model_name or not prompt_text:
        logger.warning("Model name or prompt text missing for text generation.")
        return jsonify(error="Model name and prompt are required."), 400

    messages = []
    messages.extend(chat_messages)
    messages.append({"role": "user", "content": prompt_text})
    tracker.record_chat_message(session.get('user_id', 'anonymous'), prompt_text, "user", session_id=session_id)

    current_user_id = session.get('user_id', 'anonymous')

    def generate():
        user_id = current_user_id
        try:
            from .llm_interactions import llm_service
            stream = llm_service.chat(
                messages=messages,
                model=model_name,
                user_id=user_id,
                system_prompt=system_prompt
            )
            full_response_content = []
            for chunk in stream:
                full_response_content.append(chunk)
                yield chunk
            tracker.record_chat_message(user_id, "".join(full_response_content), "assistant", session_id=session_id)
            logger.info(f"User '{user_id}' generated text with model '{model_name}'.")
        except Exception as e:
            logger.error(f"Error during text generation for user '{user_id}' with model '{model_name}': {e}")
            yield f"[ERROR] {e}"

    return app.response_class(generate(), mimetype='text/plain')

@app.route('/edit/<string:prompt_name>', methods=['GET', 'POST'])
def edit_prompt(prompt_name):
    prompt = manager.get_prompt(prompt_name)
    if not prompt:
        logger.warning(f"Attempted to edit non-existent prompt '{prompt_name}'.")
        return jsonify(success=False, message="Prompt not found"), 404

    user_id = session.get('user_id', 'anonymous')

    if request.method == 'POST':
        data = request.json
        new_content = data.get('content')
        new_category = data.get('category')
        new_tags_str = data.get('tags', '')
        new_tags = [tag.strip() for tag in new_tags_str.split(',') if tag.strip()]
        
        try:
            manager.update_prompt(prompt_name, new_content, new_category, new_tags)
            tracker.record_web_action(user_id, EventType.PROMPT_EDIT_ACTION, {"prompt_name": prompt_name, "content": new_content, "category": new_category, "tags": new_tags})
            logger.info(f"User '{user_id}' updated prompt '{prompt_name}'.")
            return jsonify(success=True, message=f"Prompt '{prompt_name}' updated successfully."), 200
        except ValueError as e:
            logger.error(f"User '{user_id}' failed to update prompt '{prompt_name}': {e}")
            return jsonify(success=False, message=str(e)), 400

    # GET request
    return jsonify({
        'name': prompt.name,
        'content': prompt.content,
        'category': prompt.category,
        'tags': prompt.tags
    }), 200

@app.route('/api/tools/improve', methods=['POST'])
def improve_prompt_api():
    data = request.json
    model = data.get('model', 'llama3.1:latest')
    prompt = data.get('prompt')
    concise = data.get('concise', False)
    user_id = session.get('user_id', 'anonymous')

    if not prompt:
        return jsonify(error="Prompt is required."), 400

    def generate():
        from .llm_interactions import llm_service
        stream = llm_service.improve_prompt(prompt, concise, model, user_id)
        full_response_content = []
        for chunk in stream:
            full_response_content.append(chunk)
            yield chunk
        
        tracker.record_command_event(
            user_id, 
            EventType.IMPROVE_COMMAND, 
            {
                "command_type": EventType.IMPROVE_COMMAND,
                "initial_prompt": prompt, 
                "concise": concise, 
                "model": model, 
                "improved_prompt": "".join(full_response_content)
            }
        )

    return app.response_class(generate(), mimetype='text/plain')

@app.route('/api/tools/evaluate', methods=['POST'])
def evaluate_prompt_api():
    data = request.json
    model = data.get('model', 'llama3.1:latest')
    prompt = data.get('prompt')
    user_id = session.get('user_id', 'anonymous')

    if not prompt:
        return jsonify(error="Prompt is required."), 400

    def generate():
        from .llm_interactions import llm_service
        stream = llm_service.evaluate_prompt(prompt, model, user_id)
        full_response_content = []
        for chunk in stream:
            full_response_content.append(chunk)
            yield chunk
        
        tracker.record_command_event(
            user_id, 
            EventType.EVALUATE_PROMPT_COMMAND, 
            {
                "command_type": EventType.EVALUATE_PROMPT_COMMAND,
                "original_prompt": prompt, 
                "model": model, 
                "evaluation_result": "".join(full_response_content)
            }
        )

    return app.response_class(generate(), mimetype='text/plain')

@app.route('/api/tools/refactor', methods=['POST'])
def refactor_code_api():
    data = request.json
    model = data.get('model', 'llama3.1:latest')
    code = data.get('code')
    user_id = session.get('user_id', 'anonymous')

    if not code:
        return jsonify(error="Code is required."), 400

    def generate():
        from .llm_interactions import llm_service
        stream = llm_service.refactor_code(code, model, user_id)
        full_response_content = []
        for chunk in stream:
            full_response_content.append(chunk)
            yield chunk
        
        tracker.record_command_event(
            user_id, 
            EventType.REFACTOR_COMMAND, 
            {
                "command_type": EventType.REFACTOR_COMMAND,
                "original_code": code, 
                "model": model, 
                "refactored_code": "".join(full_response_content)
            }
        )

    return app.response_class(generate(), mimetype='text/plain')

@app.route('/delete/<string:prompt_name>', methods=['POST'])
def delete_prompt(prompt_name):
    user_id = session.get('user_id', 'anonymous')
    try:
        manager.delete_prompt(prompt_name)
        tracker.record_web_action(user_id, EventType.PROMPT_DELETE_ACTION, {"prompt_name": prompt_name})
        logger.info(f"User '{user_id}' deleted prompt '{prompt_name}'.")
        return jsonify(success=True, message=f"Prompt '{prompt_name}' deleted successfully."), 200
    except ValueError as e:
        logger.error(f"User '{user_id}' failed to delete prompt '{prompt_name}': {e}")
        return jsonify(success=False, message=str(e)), 400

@app.route('/api/history')
def get_history():
    user_id = session.get('user_id', 'anonymous')
    report_gen = ReportGenerator(tracker)
    
    # Filter reports for the current user
    chat_history = [s for s in report_gen.get_chat_history_report() if s.get('user_id') == user_id]
    web_actions = [a for a in report_gen.get_web_action_report() if a.get('user_id') == user_id]
    commands = [c for c in report_gen.get_command_report() if c.get('user_id') == user_id]
    
    return jsonify({
        "chat_history": chat_history,
        "web_actions": web_actions,
        "commands": commands
    })

@app.route('/api/memory')
def get_memory():
    user_id = session.get('user_id', 'anonymous')
    details = memory_manager.get_user_details(user_id)
    return jsonify(details)

@app.route('/api/memory/clear', methods=['POST'])
def clear_memory():
    """Clear AI memory for the current user."""
    user_id = session.get('user_id', 'anonymous')
    memory_manager.delete_user_memory(user_id)
    logger.info(f"User '{user_id}' cleared their AI memory.")
    return jsonify(success=True)

@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    user_id = session.get('user_id', 'anonymous')
    data = request.json or {}
    event_type = data.get('type') # e.g., 'chat_session', 'web_action'
    before_ts = data.get('before') # ISO timestamp
    
    before_date = None
    if before_ts:
        try:
            from datetime import datetime
            before_date = datetime.fromisoformat(before_ts)
        except ValueError:
            pass

    tracker.clear_events(user_id, event_type=event_type, before_date=before_date)
    logger.info(f"User '{user_id}' cleared history (type={event_type}, before={before_ts}).")
    return jsonify(success=True)

@app.route('/api/history/delete_session', methods=['POST'])
def delete_session():
    user_id = session.get('user_id', 'anonymous')
    data = request.json or {}
    session_id = data.get('session_id')
    if session_id is None:
        return jsonify(success=False, message="Session ID is required"), 400
    tracker.delete_session(user_id, session_id)
    logger.info(f"User '{user_id}' deleted chat session '{session_id}'.")
    return jsonify(success=True)

@app.route('/api/history/delete_message', methods=['POST'])
def delete_message():
    user_id = session.get('user_id', 'anonymous')
    data = request.json or {}
    session_id = data.get('session_id')
    index = data.get('index')
    if session_id is None or index is None:
        return jsonify(success=False, message="Session ID and message index are required"), 400
    success = tracker.delete_message(user_id, session_id, index)
    if success:
        logger.info(f"User '{user_id}' deleted message {index} from session '{session_id}'.")
        return jsonify(success=True)
    return jsonify(success=False, message="Message not found"), 404

# ============== TOOL SYSTEM API ENDPOINTS ==============

@app.route('/api/activity')
def get_activity():
    """Get activity log for the current user."""
    user_id = session.get('user_id', 'anonymous')
    limit = request.args.get('limit', 50, type=int)
    activities = activity_logger.get_recent(user_id, limit)
    return jsonify({"activities": [a.to_dict() for a in activities]})

@app.route('/api/activity/clear', methods=['POST'])
def clear_activity():
    """Clear activity log for the current user."""
    user_id = session.get('user_id', 'anonymous')
    activity_logger.clear(user_id)
    logger.info(f"Cleared activity log for user '{user_id}'")
    return jsonify(success=True)

@app.route('/api/permissions')
def get_permissions():
    """Get current permissions for the user."""
    user_id = session.get('user_id', 'anonymous')
    permissions = permission_store.get_all_permissions(user_id)
    return jsonify(permissions)

@app.route('/api/permissions', methods=['POST'])
def update_permission():
    """Update a permission for the user."""
    user_id = session.get('user_id', 'anonymous')
    data = request.json or {}
    tool = data.get('tool')
    action = data.get('action')
    level = data.get('level')
    
    if not all([tool, action, level]):
        return jsonify(error="tool, action, and level are required"), 400
    
    try:
        permission_level = PermissionLevel(level)
        permission_store.set_permission(user_id, tool, action, permission_level)
        logger.info(f"User '{user_id}' updated permission: {tool}.{action} = {level}")
        return jsonify(success=True)
    except ValueError:
        return jsonify(error=f"Invalid permission level: {level}"), 400

@app.route('/api/permissions/reset', methods=['POST'])
def reset_permissions():
    """Reset user to default permissions."""
    user_id = session.get('user_id', 'anonymous')
    permission_store.reset_permissions(user_id)
    logger.info(f"Reset permissions for user '{user_id}'")
    return jsonify(success=True)

@app.route('/api/settings')
def get_settings():
    """Get model settings for the user."""
    user_id = session.get('user_id', 'anonymous')
    settings = settings_store.get_settings(user_id)
    return jsonify(settings)

@app.route('/api/settings', methods=['POST'])
def update_settings():
    """Update model settings for the user."""
    user_id = session.get('user_id', 'anonymous')
    data = request.json or {}
    settings_store.update_settings(user_id, data)
    return jsonify(success=True)

@app.route('/api/pending-actions')
def get_pending_actions():
    """Get actions pending approval."""
    user_id = session.get('user_id', 'anonymous')
    pending = control_layer.get_pending_actions(user_id)
    return jsonify({
        "pending": [p.to_dict() for p in pending]
    })

@app.route('/api/pending-actions/<request_id>/approve', methods=['POST'])
def approve_action(request_id):
    """Approve a pending action."""
    result = control_layer.approve_pending(request_id)
    if result:
        # Find the pending action to get the ToolAction for logging
        logger.info(f"Approved pending action: {request_id}")
        return jsonify(success=True, result=result.to_dict())
    return jsonify(error="Pending action not found"), 404

@app.route('/api/pending-actions/<request_id>/deny', methods=['POST'])
def deny_action(request_id):
    """Deny a pending action."""
    if control_layer.deny_pending(request_id):
        logger.info(f"Denied pending action: {request_id}")
        return jsonify(success=True)
    return jsonify(error="Pending action not found"), 404

@app.route('/api/tools')
def get_tools():
    """Get list of registered tools and their actions."""
    tools = []
    for tool_name in control_layer.get_registered_tools():
        tool = control_layer._tools[tool_name]
        tools.append({
            "name": tool.name,
            "category": tool.category.value,
            "description": tool.description,
            "actions": tool.get_actions()
        })
    return jsonify({"tools": tools})

# ============== END TOOL SYSTEM API ENDPOINTS ==============

def start_web_ui(port=5000):
    """Starts the Flask API server and opens the Next.js frontend in a browser."""
    api_url = f"http://127.0.0.1:{port}"
    frontend_url = "http://localhost:3000"
    
    # Open Next.js in a separate thread
    threading.Thread(target=lambda: (time.sleep(2), webbrowser.open(frontend_url))).start()
    
    memory_manager.initialize_memory_db()
    logger.info(f"Starting API server on {api_url}")
    logger.info(f"Launch URL: {frontend_url}")
    app.run(port=port, debug=False)

