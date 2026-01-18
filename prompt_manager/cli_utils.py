import datetime
import logging
from typing import Callable, Any, Dict, List
from rich.markdown import Markdown
from rich.panel import Panel

from .prompts import Prompt
from .tracker import ChatEvent, Tracker
from .ui import ConsoleUI

logger = logging.getLogger(__name__)

def streaming_live_update(ui: ConsoleUI, live_ctx: Any, content: str, title: str, style: str):
    """Helper to update the live display context."""
    live_ctx.update(Panel(Markdown(content), title=title, border_style=style))

def stream_llm_response(ui: ConsoleUI, llm_interaction_func: Callable, panel_title: str, panel_style: str, *args, **kwargs) -> str:
    """Helper function to stream LLM responses and return the full content."""
    full_response_content = []
    
    with ui.create_live_display(panel_title, panel_style) as live:
        for chunk in llm_interaction_func(*args, **kwargs):
            full_response_content.append(chunk)
            streaming_live_update(ui, live, "".join(full_response_content), panel_title, panel_style)
    
    ui.print("") 
    return "".join(full_response_content)

def execute_llm_command(
    ui: ConsoleUI,
    tracker: Tracker,
    chat_history: List[Dict],
    user_id: str,
    command_type: str,
    llm_func: Callable,
    panel_title: str,
    panel_style: str,
    input_text: str,
    model: str,
    event_details: Dict[str, Any],
    **llm_kwargs
):
    """
    Generic handler for LLM commands to reduce boilerplate in main.py.
    Handles history appending, streaming, and event recording.
    """
    user_message = {"role": "user", "content": input_text}
    
    if chat_history is not None:
        chat_history.append(user_message)

    # Call the stream helper
    assistant_response = stream_llm_response(
        ui, 
        llm_func, 
        panel_title, 
        panel_style, 
        user_id=user_id, 
        model=model, 
        **llm_kwargs
    )

    if chat_history is not None:
        assistant_message = {"role": "assistant", "content": assistant_response}
        chat_history.append(assistant_message)
    else:
        assistant_message = {"role": "assistant", "content": assistant_response}

    # Record event
    if "improved_prompt" in event_details: 
        event_details["improved_prompt"] = assistant_response
    elif "refactored_code" in event_details:
        event_details["refactored_code"] = assistant_response
    elif "evaluation_result" in event_details:
        event_details["evaluation_result"] = assistant_response
    elif "report_content" in event_details:
        event_details["report_content"] = assistant_response

    tracker.record_command_event(
        user_id=user_id, 
        command_type=command_type, 
        details=event_details,
        sub_events=[
            ChatEvent(timestamp=datetime.datetime.now(), message=user_message["content"], role=user_message["role"]),
            ChatEvent(timestamp=datetime.datetime.now(), message=assistant_message["content"], role=assistant_message["role"])
        ]
    )
    
    return assistant_response
