import os
import requests
import json
from typing import Generator, List, Dict, Optional
import logging 
from datetime import datetime

from prompt_manager import memory_manager
from .tools import ControlLayer, ToolAction, ActivityLogger, ToolResult
from .prompts_config import (
    MEMORY_INSTRUCTION, 
    IMPROVE_PROMPT_SYSTEM_PROMPT, 
    UNDERSTAND_FILE_SYSTEM_PROMPT, 
    REFACTOR_CODE_SYSTEM_PROMPT, 
    EVALUATE_PROMPT_SYSTEM_PROMPT,
    TOOL_USE_INSTRUCTION
)

# Configure logging
logger = logging.getLogger(__name__)

class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434/api/chat"):
        self.base_url = os.environ.get("OLLAMA_API_URL", base_url)

    def stream_response(self, messages: list[dict], model: str, options: Optional[dict] = None) -> Generator[str, None, None]:
        """Handle streaming interaction with Ollama API."""
        payload = {
            "model": model,
            "messages": messages,
            "stream": True
        }
        if options:
            payload["options"] = options

        try:
            with requests.post(self.base_url, json=payload, stream=True) as response:
                response.raise_for_status()
                for chunk in response.iter_lines():
                    if chunk:
                        try:
                            json_chunk = json.loads(chunk.decode('utf-8'))
                            if "content" in json_chunk["message"]:
                                yield json_chunk["message"]["content"]
                        except json.JSONDecodeError:
                            logger.warning(f"JSONDecodeError in Ollama stream: {chunk.decode('utf-8')}")
                            continue
        except requests.exceptions.ConnectionError:
            error_msg = f"ConnectionError: Could not connect to Ollama at {self.base_url}."
            logger.error(error_msg)
            yield f"Error: {error_msg}"
        except requests.exceptions.RequestException as e:
            logger.error(f"RequestException communicating with Ollama: {e}")
            yield f"Error communicating with Ollama: {e}"

class LLMService:
    def __init__(self, client: OllamaClient, control_layer: Optional[ControlLayer] = None, activity_logger: Optional[ActivityLogger] = None):
        self.client = client
        self.control_layer = control_layer
        self.activity_logger = activity_logger

    def _prepare_system_prompt(self, base_system_prompt: str, user_id: Optional[str]) -> str:
        """Inject user context/preferences into the system prompt."""
        user_preference_prompt = ""
        if user_id:
            user_details = memory_manager.get_user_details(user_id)
            if user_details:
                user_preference_prompt = "The user has the following preferences/details: " \
                                         + ", ".join([f"{k}: {v}" for k, v in user_details.items()]) + ".\n"
        
        # Add new Tool Use instruction if control layer is present
        tool_instr = TOOL_USE_INSTRUCTION if self.control_layer else ""
        
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        time_instr = f"\nCurrent Date and Time: {current_time}\n"
        
        return tool_instr + MEMORY_INSTRUCTION + time_instr + user_preference_prompt + base_system_prompt

    def _handle_tool_calls(self, user_id: str, content: str) -> List[ToolResult]:
        """Parse and execute tool calls from the response. Returns execution results."""
        if not self.control_layer or not user_id:
            return []

        import re
        # Look for <tool_call> tags OR raw JSON blocks that look like tools
        # Pattern 1: Tagged tool calls (Preferred)
        tag_pattern = r"<tool_call>(.*?)</tool_call>"
        # Pattern 2: XML-like blocks
        xml_pattern = r'<tool\s+name=["\']([\s\S]*?)["\']>([\s\S]*?)<\/tool>'
        
        matches = []
        # First try tagged JSON calls
        for m in re.finditer(tag_pattern, content, re.DOTALL):
            matches.append({"type": "json", "data": m.group(1).strip()})
        
        # Also look for XML-like blocks
        xml_matches = re.finditer(xml_pattern, content)
        for m in xml_matches:
            tool_name = m.group(1)
            inner_content = m.group(2)
            args = {}
            
            # Sub-pattern A: <argument name="..." value="..." />
            arg_matches = re.finditer(r'<argument\s+name=["\'](.*?)["\']\s+value=["\'](.*?)["\']\s*/?>', inner_content)
            for am in arg_matches:
                args[am.group(1)] = am.group(2)
            
            # Sub-pattern B: <key>value</key> (Inside <arguments> or just within <tool>)
            if not args:
                # Look for <arguments> block if present, or just scan all tags
                args_block_match = re.search(r'<arguments>(.*?)</arguments>', inner_content, re.DOTALL)
                tags_to_scan = args_block_match.group(1) if args_block_match else inner_content
                
                # Simple regex for <key>value</key> - ignore known non-param tags
                tag_matches = re.finditer(r'<([a-zA-Z0-9_]+)>([\s\S]*?)</\1>', tags_to_scan)
                for tm in tag_matches:
                    tag_name = tm.group(1)
                    if tag_name not in ['arguments', 'thought', 'think', 'tool_call']:
                        args[tag_name] = tm.group(2).strip()
            
            matches.append({
                "type": "xml",
                "tool": tool_name.strip(),
                "params": args
            })

        # Pattern 3: Raw JSON blocks (Fallback - Balanced Braces)
        # Search for names that indicate a tool call start
        marker_regex = r'"(?:name|tool)"\s*:'
        for m in re.finditer(marker_regex, content):
            # Find the starting brace of this potential JSON object
            start_index = -1
            for i in range(m.start(), -1, -1):
                if content[i] == '{':
                    start_index = i
                    break
            
            if start_index == -1:
                continue
            
            # Skip if this start_index is already within a previously matched block
            if any(start_index >= content.find(prev.get("data", "")) and 
                   start_index < content.find(prev.get("data", "")) + len(prev.get("data", "")) 
                   for prev in matches if prev["type"] == "json"):
                continue

            # Scan for balanced braces
            count = 0
            end_index = -1
            for i in range(start_index, len(content)):
                if content[i] == '{':
                    count += 1
                elif content[i] == '}':
                    count -= 1
                
                if count == 0:
                    end_index = i + 1
                    break
            
            if end_index != -1:
                candidate = content[start_index:end_index]
                try:
                    # Validate it's actually JSON and has the required fields
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict) and ("name" in parsed or "tool" in parsed):
                        matches.append({"type": "json", "data": candidate})
                except:
                    continue
        
        results = []
        pending = []
        for call_info in matches:
            try:
                if call_info["type"] == "json":
                    call_data = json.loads(call_info["data"])
                    tool_name = (call_data.get("tool") or call_data.get("name") or "").lower()
                    params = call_data.get("parameters") or call_data.get("arguments", {})
                    action_name = (call_data.get("action") or params.get("action") or "").lower()
                else:
                    tool_name = call_info["tool"].lower()
                    params = call_info["params"]
                    action_name = params.get("action", "").lower()
                
                # Filter out hallucinations
                if tool_name in ["terminate", "alise", "assistant", "stop"]:
                    logger.debug(f"Filtering out hallucinated tool call: {tool_name}")
                    continue
                
                if not tool_name or not action_name:
                    continue

                action = ToolAction(
                    tool_name=tool_name,
                    action=action_name,
                    user_id=user_id,
                    params=params
                )
                
                logger.info(f"LLM requesting tool call: {action}")
                decision, result = self.control_layer.request_execution(action)
                
                if decision == ControlDecision.PENDING:
                    from .tools.control import PendingAction
                    # Find the pending action object in the control layer
                    pending_action = next((p for p in self.control_layer.get_all_pending_actions() if p.action.request_id == action.request_id), None)
                    if pending_action:
                        pending.append(pending_action)
                elif result:
                    results.append(result)
                    if self.activity_logger:
                        self.activity_logger.log_tool_result(action, result)
                        
            except Exception as e:
                logger.error(f"Error parsing/executing tool call: {e}")
        
        return results, pending

    def _process_memory_response(self, user_id: str, full_response: str):
        """Process the full LLM response for legacy memory updates."""
        if not user_id:
            return

        logger.debug(f"Processing memory for user {user_id}")
        memory_update_prefix = "MEMORY_UPDATE: "
        memory_delete_prefix = "MEMORY_DELETE: "

        if memory_update_prefix in full_response:
            try:
                json_str = full_response.split(memory_update_prefix)[-1].strip()
                update_data = json.loads(json_str)
                if "details" in update_data:
                    memory_manager.update_user_details(user_id, update_data["details"])
                    logger.info(f"Memory updated for user {user_id}: {update_data['details']}")
            except Exception as e:
                logger.error(f"Error processing memory update for user {user_id}: {e}")

        elif memory_delete_prefix in full_response:
            try:
                memory_manager.delete_user_memory(user_id)
                logger.info(f"Memory file deleted for user {user_id}.")
            except Exception as e:
                logger.error(f"Error processing memory deletion for user {user_id}: {e}")

    def _execute_stream(self, messages: List[Dict], model: str, user_id: Optional[str] = None, depth: int = 0) -> Generator[str, None, None]:
        """Execute the stream and handle tools. Supports recursive execution for tool results."""
        if depth > 3: # Prevention for infinite tool call loops
            logger.warning(f"Max tool call depth reached for user {user_id}")
            return

        from .user_settings import settings_store
        options = {}
        if user_id:
            user_settings = settings_store.get_settings(user_id)
            # Map settings to Ollama options
            options = {
                "temperature": user_settings.get("temperature", 0.7),
                "num_ctx": user_settings.get("num_ctx", 4096),
                "top_p": user_settings.get("top_p", 0.9),
                "top_k": user_settings.get("top_k", 40),
                "repeat_penalty": user_settings.get("repeat_penalty", 1.1)
            }
            # Use default model from settings if none provided
            if not model:
                model = user_settings.get("default_model", "llama3.1:latest")

        full_response_content = []
        stream = self.client.stream_response(messages, model, options=options)
        
        for chunk in stream:
            full_response_content.append(chunk)
            yield chunk

        full_content = "".join(full_response_content)
        
        if user_id:
            from .tools.control import ControlDecision
            # Handle newer structured tool calls
            results, pending = self._handle_tool_calls(user_id, full_content)
            
            # Yield pending actions for UI notification
            for p in pending:
                logger.info(f"Yielding pending action tag for {p.action.request_id}")
                import base64
                params_json = json.dumps(p.action.params)
                params_b64 = base64.b64encode(params_json.encode()).decode()
                yield f'\n<tool_pending request_id="{p.action.request_id}" tool="{p.action.tool_name}" action="{p.action.action}" params_b64="{params_b64}" />\n'

            # If tools were executed, we need to feed the results back and get a final response
            # CRITICAL: Only recurse if we have results AND NO actions are pending.
            # If actions are pending, we MUST stop and let the user approve/deny them.
            if results and not pending:
                # Add the assistant's request to the history
                messages.append({"role": "assistant", "content": full_content})
                
                # Format results and add them as a 'user' message (or system/tool depending on model)
                results_summary = []
                for res in results:
                    status = "Success" if res.success else "Failed"
                    results_summary.append(f"<tool_result>{json.dumps(res.to_dict())}</tool_result>")
                
                feedback_msg = (
                    f"### TOOL EXECUTION RESULTS (Turn {depth + 1}) ###\n"
                    + "\n".join(results_summary) + 
                    "\n\n**INSTRUCTIONS FOR THIS TURN:**\n"
                    "1. If the goal is met, provide the final answer to the user in natural language.\n"
                    "2. If more information is needed, you may call another tool (follow protocol).\n"
                    "3. DO NOT repeat the same tool call if the results above already provide the answer."
                )
                
                messages.append({"role": "user", "content": feedback_msg})
                
                # Recursive call to handle the follow-up response
                logger.info(f"Re-triggering LLM for Turn {depth + 1} with {len(results)} tool results.")
                yield "\n" # Small separator in the stream
                yield from self._execute_stream(messages, model, user_id, depth + 1)
            
            # Handle legacy string-based memory updates
            self._process_memory_response(user_id, full_content)

    def improve_prompt(self, user_prompt: str, concise: bool, model: str, user_id: str = None) -> Generator[str, None, None]:
        system_prompt = IMPROVE_PROMPT_SYSTEM_PROMPT.format(user_prompt=user_prompt)
        final_system_prompt = self._prepare_system_prompt(system_prompt, user_id)
        
        messages = [
            {"role": "system", "content": final_system_prompt},
            {"role": "user", "content": f"Improve the following prompt: {user_prompt}{' Make it concise.' if concise else ''}"}
        ]
        return self._execute_stream(messages, model, user_id)

    def understand_file(self, file_content: str, model: str, user_id: str = None) -> Generator[str, None, None]:
        final_system_prompt = self._prepare_system_prompt(UNDERSTAND_FILE_SYSTEM_PROMPT, user_id)
        messages = [
            {"role": "system", "content": final_system_prompt},
            {"role": "user", "content": f"Analyze the following file content and generate a comprehensive report:\n\n```\n{file_content}\n```"}
        ]
        return self._execute_stream(messages, model, user_id)

    def refactor_code(self, code: str, model: str, user_id: str = None) -> Generator[str, None, None]:
        final_system_prompt = self._prepare_system_prompt(REFACTOR_CODE_SYSTEM_PROMPT, user_id)
        messages = [
            {"role": "system", "content": final_system_prompt},
            {"role": "user", "content": f"Refactor the following code:\n\n```\n{code}\n```"}
        ]
        return self._execute_stream(messages, model, user_id)

    def evaluate_prompt(self, user_prompt: str, model: str, user_id: str = None) -> Generator[str, None, None]:
        final_system_prompt = self._prepare_system_prompt(EVALUATE_PROMPT_SYSTEM_PROMPT, user_id)
        messages = [
            {"role": "system", "content": final_system_prompt},
            {"role": "user", "content": f"Evaluate the following prompt and provide a critique:\n\n{user_prompt}"}
        ]
        return self._execute_stream(messages, model, user_id)

    def chat(self, messages: List[Dict], model: str, user_id: str = None, system_prompt: str = "") -> Generator[str, None, None]:
        # Handle chat specific system prompt combination
        final_system_prompt_content = self._prepare_system_prompt(system_prompt, user_id)
        
        # Insert system prompt at the beginning of the chat history
        chat_messages = [{"role": "system", "content": final_system_prompt_content}] + messages
        return self._execute_stream(chat_messages, model, user_id)

ollama_client = OllamaClient()
llm_service = LLMService(ollama_client)
