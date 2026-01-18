import os
import logging
from pathlib import Path
from typing import Optional, List, Dict
from collections import deque
import datetime
import uuid

from .prompts import Prompt, PromptManager
from .tracker import Tracker, EventType, ReportGenerator, ChatEvent
from .ui import ConsoleUI
from .llm_interactions import llm_service
from . import cli_utils

logger = logging.getLogger(__name__)

def handle_add_prompt(manager: PromptManager, tracker: Tracker, ui: ConsoleUI, name: str, content: str, category: str, tags: List[str], user_id: str):
    try:
        prompt = Prompt(name, content, category, tags)
        manager.add_prompt(prompt)
        tracker.record_web_action(user_id, EventType.PROMPT_ADD_ACTION, {"prompt_name": name, "prompt_content": content, "category": category, "tags": tags}) 
        ui.print_success(f"Prompt '{name}' added successfully.")
        logger.info(f"Prompt '{name}' added successfully by user '{user_id}'.")
    except ValueError as e:
        ui.print_error(f"Error: {e}")
        logger.error(f"Error adding prompt for user '{user_id}': {e}")

def handle_list_prompts(manager: PromptManager, tracker: Tracker, ui: ConsoleUI, user_id: str):
    prompts = manager.list_prompts()
    if prompts:
        tracker.record_web_action(user_id, EventType.PROMPT_LIST_ACTION) 
        ui.display_header("Available Prompts")
        for p in prompts:
            ui.display_prompt(p)
        ui.display_footer()
        logger.info(f"Prompts listed for user '{user_id}'.")
    else:
        ui.print_warning("No prompts available.")
        logger.info(f"No prompts available for user '{user_id}'.")

def handle_search_prompts(manager: PromptManager, tracker: Tracker, ui: ConsoleUI, query: str, user_id: str):
    results = manager.search_prompts(query)
    if results:
        tracker.record_web_action(user_id, EventType.PROMPT_SEARCH_ACTION, {"query": query}) 
        ui.display_header(f"Search Results for '{query}'")
        for p in results:
            ui.display_prompt(p)
        ui.display_footer()
        logger.info(f"Prompts searched for query '{query}' by user '{user_id}'. Found {len(results)} results.")
    else:
        ui.print_warning(f"No prompts found matching '{query}'.")
        logger.info(f"No prompts found matching '{query}' for user '{user_id}'.")

def handle_get_prompt(manager: PromptManager, tracker: Tracker, ui: ConsoleUI, name: str, user_id: str):
    prompt = manager.get_prompt(name)
    if prompt:
        tracker.record_web_action(user_id, EventType.PROMPT_GET_ACTION, {"prompt_name": name}) 
        ui.display_header(f"Prompt: {prompt.name}")
        ui.display_prompt(prompt, include_content=False)
        ui.display_footer()
        logger.info(f"Prompt '{name}' retrieved for user '{user_id}'.")
    else:
        ui.print_error(f"Error: Prompt '{name}' not found.")
        logger.error(f"Error: Prompt '{name}' not found for user '{user_id}'.")

def handle_edit_prompt(manager: PromptManager, tracker: Tracker, ui: ConsoleUI, name: str, content: Optional[str], category: Optional[str], tags: Optional[List[str]], user_id: str):
    try:
        manager.update_prompt(name, content, category, tags)
        tracker.record_web_action(user_id, EventType.PROMPT_EDIT_ACTION, {"prompt_name": name, "content": content, "category": category, "tags": tags}) 
        ui.print_success(f"Prompt '{name}' updated successfully.")
        logger.info(f"Prompt '{name}' updated successfully by user '{user_id}'.")
    except ValueError as e:
        ui.print_error(f"Error: {e}")
        logger.error(f"Error updating prompt '{name}' for user '{user_id}': {e}")

def handle_delete_prompt(manager: PromptManager, tracker: Tracker, ui: ConsoleUI, name: str, user_id: str):
    try:
        manager.delete_prompt(name)
        tracker.record_web_action(user_id, EventType.PROMPT_DELETE_ACTION, {"prompt_name": name}) 
        ui.print_success(f"Prompt '{name}' deleted successfully.")
        logger.info(f"Prompt '{name}' deleted successfully by user '{user_id}'.")
    except ValueError as e:
        ui.print_error(f"Error: {e}")
        logger.error(f"Error deleting prompt '{name}' for user '{user_id}': {e}")

def handle_improve_prompt(tracker: Tracker, ui: ConsoleUI, chat_history: deque, user_prompt: str, concise: bool, model: str, user_id: str):
    cli_utils.execute_llm_command(
        ui=ui,
        tracker=tracker,
        chat_history=chat_history,
        user_id=user_id,
        command_type=EventType.IMPROVE_COMMAND,
        llm_func=llm_service.improve_prompt,
        panel_title="Improved Prompt (Streaming)",
        panel_style="bold blue",
        input_text=user_prompt,
        model=model,
        event_details={
            "initial_prompt": user_prompt,
            "concise": concise,
            "model": model,
            "improved_prompt": "" 
        },
        user_prompt=user_prompt,
        concise=concise
    )
    logger.info(f"Improve prompt command executed for user '{user_id}' with model '{model}'.")

def handle_refactor_code(tracker: Tracker, ui: ConsoleUI, chat_history: deque, code_path: Path, model: str, user_id: str):
    if not code_path.exists():
         ui.print_error(f"Error: File '{code_path}' not found.")
         return

    code = code_path.read_text()
    
    cli_utils.execute_llm_command(
        ui=ui,
        tracker=tracker,
        chat_history=chat_history,
        user_id=user_id,
        command_type=EventType.REFACTOR_COMMAND,
        llm_func=llm_service.refactor_code,
        panel_title="Refactoring Code (Streaming)",
        panel_style="bold green",
        input_text=code,
        model=model,
        event_details={
            "model": model,
            "original_code": code,
            "refactored_code": "" 
        },
        code=code 
    )
    ui.print_success("\nDone.") 
    logger.info(f"Refactor code command executed for user '{user_id}' on file '{code_path}' with model '{model}'.")

def handle_evaluate_prompt(tracker: Tracker, ui: ConsoleUI, chat_history: deque, user_prompt: str, model: str, user_id: str):
    cli_utils.execute_llm_command(
        ui=ui,
        tracker=tracker,
        chat_history=chat_history,
        user_id=user_id,
        command_type=EventType.EVALUATE_PROMPT_COMMAND,
        llm_func=llm_service.evaluate_prompt,
        panel_title="Evaluating Prompt (Streaming)",
        panel_style="bold yellow",
        input_text=user_prompt,
        model=model,
        event_details={
            "model": model,
            "original_prompt": user_prompt,
            "evaluation_result": ""
        },
        user_prompt=user_prompt 
    )
    logger.info(f"Evaluate prompt command executed for user '{user_id}' with model '{model}'.")

def handle_chat(tracker: Tracker, ui: ConsoleUI, chat_history: deque, initial_message: Optional[str], model: str, system_prompt: str, user_id: str):
    ui.display_header("Interactive Chat (Type 'bye' or press Ctrl+C to exit)", style="bold green")
    
    current_session_messages = [] 
    
    session_id = str(uuid.uuid4())
    
    if len(chat_history) == 0 or chat_history[-1]['role'] != 'system':
         chat_history.append({"role": "system", "content": system_prompt})

    if initial_message:
        chat_history.append({"role": "user", "content": initial_message})
        current_session_messages.append({"role": "user", "content": initial_message})
        ui.print(f"[bold blue]You:[/bold blue] {initial_message}")

        assistant_response = cli_utils.stream_llm_response(
            ui,
            llm_service.chat, 
            "Interactive Chat (Streaming)", 
            "bold green", 
            messages=list(chat_history), model=model, user_id=user_id, system_prompt=system_prompt
        ).strip()
        chat_history.append({"role": "assistant", "content": assistant_response})
        current_session_messages.append({"role": "assistant", "content": assistant_response})

    try:
        while True:
            user_input = ui.input("[bold blue]You:[/bold blue] ").strip()
            if user_input.lower() == "bye":
                break
            if not user_input:
                continue

            chat_history.append({"role": "user", "content": user_input})
            current_session_messages.append({"role": "user", "content": user_input})

            assistant_response = cli_utils.stream_llm_response(
                ui,
                llm_service.chat, 
                "Interactive Chat (Streaming)", 
                "bold green", 
                messages=list(chat_history), model=model, user_id=user_id, system_prompt=system_prompt
            ).strip()
            chat_history.append({"role": "assistant", "content": assistant_response})
            current_session_messages.append({"role": "assistant", "content": assistant_response})

    except KeyboardInterrupt:
        ui.print_warning("\nChat session ended by user.")
        logger.info(f"Chat session ended by user '{user_id}'.")
    finally:
        ui.display_footer(style="bold green")
        if current_session_messages:
            tracker.record_chat_session(user_id, current_session_messages, session_id=session_id) 
        logger.info(f"Chat session concluded for user '{user_id}'.")

def handle_understand_file(tracker: Tracker, ui: ConsoleUI, file_path: str, model: str, user_id: str):
    if not os.path.exists(file_path):
        ui.print_error(f"Error: File '{file_path}' not found.")
        logger.error(f"Error: File '{file_path}' not found for user '{user_id}'.")
        return
    
    try:
        with open(file_path, 'r') as f:
            file_content = f.read()
        
        ui.print(f"[bold]Understanding Report for '{file_path}' (Streaming)[/]")

        cli_utils.execute_llm_command(
            ui=ui,
            tracker=tracker,
            chat_history=None, 
            user_id=user_id,
            command_type=EventType.UNDERSTAND_COMMAND,
            llm_func=llm_service.understand_file,
            panel_title="Model Analysis (Streaming)",
            panel_style="bold blue",
            input_text=f"Analyze file: {file_path}", 
            model=model,
            event_details={
                "file_path": file_path,
                "model": model,
                "report_content": ""
            },
            file_content=file_content 
        )
        logger.info(f"Understand file command executed for user '{user_id}' on file '{file_path}' with model '{model}'.")

    except Exception as e:
        ui.print_error(f"Error reading file or communicating with model: {e}")
        logger.error(f"Error reading file '{file_path}' or communicating with model for user '{user_id}': {e}")

def handle_history(tracker: Tracker, ui: ConsoleUI):
    report_generator = ReportGenerator(tracker)

    ui.display_header("User Interaction History", style="bold magenta")

    summary = report_generator.get_interaction_summary()
    ui.print("\n[bold blue]--- Interaction Summary ---[/bold blue]")
    ui.print(f"Total Events: [green]{summary['total_events']}[/green]")
    ui.print("Event Counts by Type:")
    for event_type, count in summary["event_counts"].items():
        ui.print(f"  - [yellow]{event_type}:[/yellow] [green]{count}[/green]")

    chat_sessions_report = report_generator.get_chat_history_report()
    ui.print("\n[bold blue]--- Chat History Report ---[/bold blue]")
    if chat_sessions_report:
        for session in chat_sessions_report:
            ui.print(f"[bold]Chat Session ({session['timestamp']}) by {session['user_id']}:[/bold]")
            for message in session["messages"]:
                ui.print(f"  [{message['timestamp']}] [bold]{message['role'].capitalize()}:[/bold] {message['content']}")
            ui.print("")
    else:
        ui.print_warning("No chat sessions recorded.")

    command_report = report_generator.get_command_report()
    ui.print("\n[bold blue]--- Command Report ---[/bold blue]")
    if command_report:
        for command in command_report:
            ui.print(f"[bold]Command Type: {command['command_type']}[/bold] ({command['timestamp']}) by {command['user_id']}")
            ui.print(f"  Details: {command['details']}")
            if command["sub_events"]:
                ui.print("  Sub-events:")
                for sub_event in command["sub_events"]:
                    ui.print(f"    - Type: {sub_event['event_type']}, Timestamp: {sub_event['timestamp']}, Details: {sub_event['details']}")
            ui.print("")
    else:
        ui.print_warning("No command events recorded.")

    web_action_report = report_generator.get_web_action_report()
    ui.print("\n[bold blue]--- Web Action Report ---[/bold blue]")
    if web_action_report:
        for action in web_action_report:
            ui.print(f"[bold]Web Action Type: {action['action_type']}[/bold] ({action['timestamp']}) by {action['user_id']}")
            ui.print(f"  Details: {action['details']}")
            ui.print("")
    else:
        ui.print_warning("No web action events recorded.")

    ui.display_footer(style="bold magenta")
    logger.info("User interaction history displayed.")

def handle_clear_history(tracker: Tracker, ui: ConsoleUI, event_type: Optional[str], user_id: str):
    if event_type:
        tracker.clear_events_by_type(event_type, user_id=user_id) 
        ui.print_success(f"Interaction history for event type '{event_type}' for user '{user_id}' cleared successfully.")
        logger.info(f"Interaction history for event type '{event_type}' cleared for user '{user_id}'.")
    else:
        tracker.reset(user_id=user_id) 
        ui.print_success(f"All interaction history cleared successfully for user '{user_id}'.")
        logger.info(f"All interaction history cleared for user '{user_id}'.")
