from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.live import Live
from typing import Optional, ContextManager

from .prompts import Prompt

class ConsoleUI:
    """
    Encapsulates all console interactions to separate presentation from logic.
    """
    def __init__(self):
        self.console = Console()

    def print(self, *args, **kwargs):
        """Wrapper for direct console print (use sparingly)."""
        self.console.print(*args, **kwargs)

    def print_success(self, message: str):
        self.console.print(f"[green bold]{message}[/]")

    def print_error(self, message: str):
        self.console.print(f"[red bold]{message}[/]")

    def print_warning(self, message: str):
        self.console.print(f"[yellow bold]{message}[/]")

    def print_info(self, message: str):
        self.console.print(f"[blue]{message}[/]")

    def display_header(self, title: str, style: str = "bold blue"):
        self.console.print(Panel(title, style=style))

    def display_footer(self, style: str = "bold blue"):
        self.console.print(Panel("", style=style))

    def display_prompt(self, prompt: Prompt, include_content: bool = True):
        self.console.print(f"[bold]Name:[/][blue] {prompt.name}[/]")
        self.console.print(f"  [bold]Category:[/][blue] {prompt.category}[/]")
        self.console.print(f"  [bold]Tags:[/][blue] {', '.join(prompt.tags) if prompt.tags else 'None'}[/]")
        if include_content:
            content_preview = prompt.content[:70] + "..." if len(prompt.content) > 70 else prompt.content
            self.console.print(f"  [bold]Content:[/][blue] {content_preview}[/]")
        self.console.print("")

    def input(self, prompt_text: str) -> str:
        return self.console.input(prompt_text)

    def create_live_display(self, title: str, style: str) -> Live:
        """
        Creates a rich Live display object initialized with an empty Markdown panel.
        """
        return Live(
            Panel(Markdown(""), title=title, border_style=style),
            console=self.console,
            screen=False,
            refresh_per_second=4
        )
