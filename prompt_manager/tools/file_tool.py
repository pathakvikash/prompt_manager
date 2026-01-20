"""
File tool for AI to read and manage files.
"""

from pathlib import Path
from typing import List, Optional
from .base import BaseTool, ToolResult, ToolCategory, PermissionLevel
import logging
import os

logger = logging.getLogger(__name__)


class FileTool(BaseTool):
    """
    Tool for file operations with path restrictions.
    
    Actions:
    - read: Read file contents
    - list: List directory contents
    - write: Write to file (requires confirmation)
    - delete: Delete file (denied by default)
    """
    
    def __init__(self, allowed_paths: Optional[List[str]] = None):
        """
        Initialize with optional path restrictions.
        
        Args:
            allowed_paths: List of allowed directory paths. If None, all paths allowed (dangerous!).
        """
        self.allowed_paths = [Path(p).resolve() for p in (allowed_paths or [])]
        if not self.allowed_paths:
            logger.warning("FileTool initialized without path restrictions - all paths allowed!")
    
    @property
    def name(self) -> str:
        return "file"
    
    @property
    def category(self) -> ToolCategory:
        return ToolCategory.FILE
    
    @property
    def description(self) -> str:
        return "Read, list, and manage files on the system within allowed directories"
    
    def get_actions(self) -> List[str]:
        return ["read", "list", "write", "delete"]
    
    def get_default_permission(self, action: str) -> PermissionLevel:
        return {
            "read": PermissionLevel.AUTO,
            "list": PermissionLevel.AUTO,
            "write": PermissionLevel.CONFIRM,
            "delete": PermissionLevel.DENY,
        }.get(action, PermissionLevel.DENY)
    
    def _is_path_allowed(self, path: Path) -> bool:
        """Check if path is within allowed directories."""
        if not self.allowed_paths:
            return True  # No restrictions (dangerous!)
        
        try:
            resolved = path.resolve()
            return any(
                resolved == allowed or allowed in resolved.parents
                for allowed in self.allowed_paths
            )
        except Exception:
            return False
    
    def execute(self, action: str, user_id: str, **kwargs) -> ToolResult:
        path_str = kwargs.get("path")
        
        if not path_str and action != "list":
            return ToolResult(
                tool_name=self.name,
                action=action,
                success=False,
                result=None,
                error="Path is required"
            )
        
        path = Path(path_str) if path_str else Path(".")
        
        if not self._is_path_allowed(path):
            logger.warning(f"Path not allowed: {path}")
            return ToolResult(
                tool_name=self.name,
                action=action,
                success=False,
                result=None,
                error=f"Path not allowed: {path}"
            )
        
        try:
            if action == "read":
                if not path.exists():
                    return ToolResult(
                        tool_name=self.name,
                        action=action,
                        success=False,
                        result=None,
                        error=f"File not found: {path}"
                    )
                if not path.is_file():
                    return ToolResult(
                        tool_name=self.name,
                        action=action,
                        success=False,
                        result=None,
                        error=f"Not a file: {path}"
                    )
                
                content = path.read_text(encoding='utf-8', errors='replace')
                # Limit content size
                max_size = 50000  # 50KB
                truncated = len(content) > max_size
                
                logger.info(f"Read file: {path} ({len(content)} chars)")
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=True,
                    result={
                        "path": str(path),
                        "content": content[:max_size],
                        "size": len(content),
                        "truncated": truncated
                    }
                )
            
            elif action == "list":
                directory = path.resolve()
                if not directory.exists():
                    return ToolResult(
                        tool_name=self.name,
                        action=action,
                        success=False,
                        result=None,
                        error=f"Directory not found: {directory}"
                    )
                if not directory.is_dir():
                    return ToolResult(
                        tool_name=self.name,
                        action=action,
                        success=False,
                        result=None,
                        error=f"Not a directory: {directory}"
                    )
                
                files = []
                for f in directory.iterdir():
                    try:
                        stat = f.stat()
                        files.append({
                            "name": f.name,
                            "is_dir": f.is_dir(),
                            "size": stat.st_size if f.is_file() else None,
                            "modified": stat.st_mtime
                        })
                    except (PermissionError, OSError):
                        continue
                
                logger.info(f"Listed directory: {directory} ({len(files)} items)")
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=True,
                    result={"path": str(directory), "files": files}
                )
            
            elif action == "write":
                content = kwargs.get("content", "")
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding='utf-8')
                
                logger.info(f"Wrote file: {path} ({len(content)} chars)")
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=True,
                    result={"path": str(path), "bytes_written": len(content)}
                )
            
            elif action == "delete":
                if not path.exists():
                    return ToolResult(
                        tool_name=self.name,
                        action=action,
                        success=False,
                        result=None,
                        error=f"File not found: {path}"
                    )
                
                path.unlink()
                logger.info(f"Deleted file: {path}")
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=True,
                    result={"path": str(path), "deleted": True}
                )
            
            else:
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=False,
                    result=None,
                    error=f"Unknown action: {action}"
                )
        
        except PermissionError as e:
            logger.error(f"Permission denied: {path}")
            return ToolResult(
                tool_name=self.name,
                action=action,
                success=False,
                result=None,
                error=f"Permission denied: {path}"
            )
        except Exception as e:
            logger.exception(f"File tool error: {action} on {path}")
            return ToolResult(
                tool_name=self.name,
                action=action,
                success=False,
                result=None,
                error=str(e)
            )
