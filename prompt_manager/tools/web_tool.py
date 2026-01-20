"""
Web tool for AI to search the internet and read web pages.
"""

from typing import List, Dict, Optional
from .base import BaseTool, ToolResult, ToolCategory, PermissionLevel
import requests
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

class WebTool(BaseTool):
    """
    Tool for searching the web and reading page contents.
    
    Actions:
    - search: Find information and links on a topic
    - read: Extract main text content from a URL
    """
    
    @property
    def name(self) -> str:
        return "web"
    
    @property
    def category(self) -> ToolCategory:
        return ToolCategory.WEB
    
    @property
    def description(self) -> str:
        return "Search the internet and read web page content"
    
    def get_actions(self) -> List[str]:
        return ["search", "read"]
    
    def get_default_permission(self, action: str) -> PermissionLevel:
        return {
            "search": PermissionLevel.AUTO,
            "read": PermissionLevel.AUTO,
        }.get(action, PermissionLevel.AUTO)
    
    def execute(self, action: str, user_id: str, **kwargs) -> ToolResult:
        try:
            if action == "search":
                return self._search(kwargs.get("query"))
            elif action == "read":
                return self._read(kwargs.get("url"))
            else:
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=False,
                    result=None,
                    error=f"Unknown action: {action}"
                )
        except Exception as e:
            logger.exception(f"Web tool error: {action}")
            return ToolResult(
                tool_name=self.name,
                action=action,
                success=False,
                result=None,
                error=str(e)
            )

    def _search(self, query: str) -> ToolResult:
        if not query:
            return ToolResult(self.name, "search", False, error="No query provided")
        
        try:
            # Try newest 'ddgs' package first, then fallback
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS
                
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5))
                
            return ToolResult(
                tool_name=self.name,
                action="search",
                success=True,
                result={"query": query, "results": results}
            )
        except Exception as e:
            return ToolResult(self.name, "search", False, error=f"Search failed: {e}")

    def _read(self, url: str) -> ToolResult:
        if not url:
            return ToolResult(self.name, "read", False, error="No URL provided")
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()

            # Get text
            text = soup.get_text()
            
            # Break into lines and remove leading and trailing whitespace
            lines = (line.strip() for line in text.splitlines())
            # Break multi-headlines into a line each
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            # Drop blank lines
            text = '\n'.join(chunk for chunk in chunks if chunk)
            
            # Limit text length to prevent context window issues (approx 3000 chars)
            if len(text) > 4000:
                text = text[:4000] + "\n... (content truncated)"

            return ToolResult(
                tool_name=self.name,
                action="read",
                success=True,
                result={"url": url, "content": text}
            )
        except Exception as e:
            return ToolResult(self.name, "read", False, error=f"Failed to read page: {e}")
