import os
from pathlib import Path
from typing import Annotated, Optional 
import logging 

import typer

from .prompts import PromptManager
from .tracker import Tracker
from . import memory_manager 
from collections import deque 
from .prompts_config import SYSTEM_PROMPTS 
from .ui import ConsoleUI
from . import handlers

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


ui = ConsoleUI()

app = typer.Typer()

manager = PromptManager()
tracker = Tracker() 

chat_history = deque(maxlen=10)


@app.command(name="web")
def web_command():
    "Launch the web UI"
    from .web_ui import start_web_ui
    start_web_ui()


@app.command(name="add")
def add_prompt_command(
    name: Annotated[str, typer.Argument(help="Name of the prompt")],
    content: Annotated[str, typer.Argument(help="Content of the prompt")],
    category: Annotated[str, typer.Argument(help="Category for the prompt (optional)")] = "Uncategorized",
    tags: Annotated[list[str], typer.Argument(help="Space-separated tags for the prompt (optional)")] = None,
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    "Add a new prompt"
    handlers.handle_add_prompt(manager, tracker, ui, name, content, category, tags, user_id)


@app.command(name="list")
def list_prompts_command(
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    "List all prompts"
    handlers.handle_list_prompts(manager, tracker, ui, user_id)


@app.command(name="search")
def search_prompts_command(
    query: Annotated[str, typer.Argument(help="Query to search prompts by name, content, category, or tags")],
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    "Search for prompts"
    handlers.handle_search_prompts(manager, tracker, ui, query, user_id)


@app.command(name="get")
def get_prompt_command(
    name: Annotated[str, typer.Argument(help="Name of the prompt to retrieve")],
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    "Retrieve and display a prompt's content"
    handlers.handle_get_prompt(manager, tracker, ui, name, user_id)


@app.command(name="edit")
def edit_prompt_command(
    name: Annotated[str, typer.Argument(help="Name of the prompt to edit")],
    content: Annotated[str, typer.Option("--content", help="New content for the prompt")] = None,
    category: Annotated[str, typer.Option("--category", help="New category for the prompt")] = None,
    tags: Annotated[list[str], typer.Option("--tags", help="New space-separated tags for the prompt")] = None,
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    "Edit an existing prompt"
    handlers.handle_edit_prompt(manager, tracker, ui, name, content, category, tags, user_id)


@app.command(name="delete")
def delete_prompt_command(
    name: Annotated[str, typer.Argument(help="Name of the prompt to delete")],
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    "Delete a prompt"
    handlers.handle_delete_prompt(manager, tracker, ui, name, user_id)


@app.command(name="improve")
def improve_prompt_command(
    user_prompt: Annotated[str, typer.Argument(help="The user prompt to improve")],
    concise: Annotated[bool, typer.Option("--concise", help="Improve the prompt to be more concise")] = False,
    model: Annotated[str, typer.Option("--model", help="Model to use for improvement (default: llama3.1:latest)")] = "llama3.1:latest",
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    "Improve a user prompt"
    handlers.handle_improve_prompt(tracker, ui, chat_history, user_prompt, concise, model, user_id)


@app.command(name="refactor-code")
def refactor_code_command(
    code_path: Annotated[Path, typer.Argument(help="Path to the Python file to refactor")],
    model: Annotated[str, typer.Option("--model", help="Model to use for refactoring (default: llama3.1:latest)")] = "llama3.1:latest",
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    """Refactor Python code for readability and maintainability."""
    handlers.handle_refactor_code(tracker, ui, chat_history, code_path, model, user_id)


@app.command(name="evaluate-prompt")
def evaluate_prompt_command(
    user_prompt: Annotated[str, typer.Argument(help="The prompt you want to evaluate")],
    model: Annotated[str, typer.Option("--model", help="Model to use for evaluation (default: llama3.1:latest)")] = "llama3.1:latest",
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    """Critically evaluate a user prompt and get improvement suggestions."""
    handlers.handle_evaluate_prompt(tracker, ui, chat_history, user_prompt, model, user_id)


@app.command(name="chat")
def chat_command(
    initial_message: Annotated[str, typer.Argument(help="An optional initial message to start the chat")] = None,
    model: Annotated[str, typer.Option("--model", help="Model to use for chat (default: llama3.1:latest)")] = "llama3.1:latest",
    persona: Annotated[str, typer.Option("--persona", help="Choose a persona for the AI (default, doc, reviewer, mentor, secure, toolsmith)")] = "default",
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    "Start an interactive chat session with the LLM"
    system_prompt = SYSTEM_PROMPTS.get(persona, SYSTEM_PROMPTS["default"])
    handlers.handle_chat(tracker, ui, chat_history, initial_message, model, system_prompt, user_id)


@app.command(name="understand")
def understand_file_command(
    file_path: Annotated[str, typer.Argument(help="Path to the file to understand")],
    model: Annotated[str, typer.Option("--model", help="Model to use for understanding (default: llama3.1:latest)")] = "llama3.1:latest",
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID for tracking purposes")] = "default_user", 
):
    "Generate a report on a given file"
    handlers.handle_understand_file(tracker, ui, file_path, model, user_id)


@app.command(name="history")
def history_command():
    "Display user interaction history and reports"
    handlers.handle_history(tracker, ui)


@app.command(name="clear-history")
def clear_history_command(
    event_type: Annotated[Optional[str], typer.Option("--type", "-t", help="Clear only events of a specific type (e.g., improve_command, chat_session, understand_command)")] = None,
    user_id: Annotated[str, typer.Option("--user-id", "-u", help="User ID to clear history for")] = "default_user", 
):
    """Clear all recorded user interaction history, or specific event types"""
    handlers.handle_clear_history(tracker, ui, event_type, user_id)


def main():
    memory_manager.initialize_memory_db() 
    app()

if __name__ == "__main__":
    main()
