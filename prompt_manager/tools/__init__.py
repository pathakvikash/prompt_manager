"""
AI Tool System Package

Provides a unified interface for AI tools with:
- Permission management (AUTO, NOTIFY, CONFIRM, DENY)
- Control layer for approval queues
- Activity logging for UI display
"""

from .base import (
    PermissionLevel,
    ToolCategory,
    ToolAction,
    ToolResult,
    BaseTool,
)
from .permissions import PermissionStore, PermissionRule
from .control import ControlLayer, ControlDecision, PendingAction
from .activity import ActivityLogger, ActivityType, ActivityEntry
from .memory_tool import MemoryTool
from .file_tool import FileTool
from .web_tool import WebTool

__all__ = [
    # Base
    "PermissionLevel",
    "ToolCategory", 
    "ToolAction",
    "ToolResult",
    "BaseTool",
    # Permissions
    "PermissionStore",
    "PermissionRule",
    # Control
    "ControlLayer",
    "ControlDecision",
    "PendingAction",
    # Activity
    "ActivityLogger",
    "ActivityType",
    "ActivityEntry",
    # Tools
    "MemoryTool",
    "FileTool",
    "WebTool",
]
