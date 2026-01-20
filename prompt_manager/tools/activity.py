"""
Activity logging for AI tool usage.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Callable, Optional
from enum import Enum
from .base import ToolResult, ToolAction, PermissionLevel
import json
import os
import logging

logger = logging.getLogger(__name__)


class ActivityType(Enum):
    """Types of activities that can be logged."""
    TOOL_REQUEST = "tool_request"
    TOOL_EXECUTED = "tool_executed"
    TOOL_DENIED = "tool_denied"
    TOOL_PENDING = "tool_pending"
    TOOL_APPROVED = "tool_approved"
    MEMORY_READ = "memory_read"
    MEMORY_WRITE = "memory_write"
    MEMORY_DELETE = "memory_delete"
    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    FILE_LIST = "file_list"
    WEB_FETCH = "web_fetch"
    WEB_SEARCH = "web_search"


@dataclass
class ActivityEntry:
    """A single activity log entry."""
    type: ActivityType
    user_id: str
    timestamp: datetime
    tool: str
    action: str
    summary: str
    details: Dict[str, Any] = field(default_factory=dict)
    permission_level: Optional[str] = None
    success: Optional[bool] = None
    
    def to_dict(self) -> Dict:
        return {
            "type": self.type.value,
            "user_id": self.user_id,
            "timestamp": self.timestamp.isoformat(),
            "tool": self.tool,
            "action": self.action,
            "summary": self.summary,
            "details": self.details,
            "permission_level": self.permission_level,
            "success": self.success,
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ActivityEntry':
        return cls(
            type=ActivityType(data["type"]),
            user_id=data["user_id"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            tool=data["tool"],
            action=data["action"],
            summary=data["summary"],
            details=data.get("details", {}),
            permission_level=data.get("permission_level"),
            success=data.get("success")
        )


class ActivityLogger:
    """
    Logs all tool activity for the UI.
    
    Features:
    - Persistent storage to JSON file
    - Real-time listeners for WebSocket updates
    - Automatic log rotation (max entries)
    - Filtering by user and activity type
    """
    
    def __init__(self, storage_path: str = None, max_entries: int = 1000):
        if storage_path is None:
            storage_path = os.path.join(
                os.path.dirname(__file__), "..", "..", "activity_log.json"
            )
        self.storage_path = os.path.abspath(storage_path)
        self.max_entries = max_entries
        self._entries: List[ActivityEntry] = []
        self._listeners: List[Callable[[ActivityEntry], None]] = []
        self._load()
    
    def _load(self):
        """Load activity log from storage."""
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    self._entries = [ActivityEntry.from_dict(e) for e in data]
                logger.info(f"Loaded {len(self._entries)} activity entries")
            except Exception as e:
                logger.warning(f"Failed to load activity log: {e}")
                self._entries = []
    
    def _save(self):
        """Save activity log to storage."""
        # Keep only recent entries
        self._entries = self._entries[-self.max_entries:]
        try:
            with open(self.storage_path, 'w') as f:
                json.dump([e.to_dict() for e in self._entries], f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save activity log: {e}")
    
    def log(self, entry: ActivityEntry):
        """Log an activity entry."""
        self._entries.append(entry)
        self._save()
        
        # Notify real-time listeners
        for listener in self._listeners:
            try:
                listener(entry)
            except Exception as e:
                logger.warning(f"Activity listener error: {e}")
    
    def log_tool_result(self, action: ToolAction, result: ToolResult):
        """Convenience method to log a tool execution result."""
        # Determine activity type based on tool and action
        activity_type = self._get_activity_type(action.tool_name, action.action, result.success)
        
        entry = ActivityEntry(
            type=activity_type,
            user_id=action.user_id,
            timestamp=datetime.now(),
            tool=action.tool_name,
            action=action.action,
            summary=f"{action.tool_name}.{action.action}",
            details={
                "params": action.params,
                "result": result.result if result.success else None,
                "error": result.error,
                "execution_time_ms": result.execution_time_ms,
            },
            permission_level=result.permission_level.value if result.permission_level else None,
            success=result.success
        )
        self.log(entry)
    
    def log_pending(self, action: ToolAction):
        """Log a pending action."""
        entry = ActivityEntry(
            type=ActivityType.TOOL_PENDING,
            user_id=action.user_id,
            timestamp=datetime.now(),
            tool=action.tool_name,
            action=action.action,
            summary=f"{action.tool_name}.{action.action} (pending approval)",
            details={"params": action.params, "request_id": action.request_id},
            success=None
        )
        self.log(entry)
    
    def log_approved(self, action: ToolAction, result: ToolResult):
        """Log an approved action."""
        entry = ActivityEntry(
            type=ActivityType.TOOL_APPROVED,
            user_id=action.user_id,
            timestamp=datetime.now(),
            tool=action.tool_name,
            action=action.action,
            summary=f"{action.tool_name}.{action.action} (approved)",
            details={
                "params": action.params,
                "result": result.result if result.success else None,
                "error": result.error,
            },
            success=result.success
        )
        self.log(entry)
    
    def _get_activity_type(self, tool: str, action: str, success: bool) -> ActivityType:
        """Map tool.action to activity type."""
        if not success:
            return ActivityType.TOOL_DENIED
        
        type_map = {
            ("memory", "get"): ActivityType.MEMORY_READ,
            ("memory", "update"): ActivityType.MEMORY_WRITE,
            ("memory", "delete"): ActivityType.MEMORY_DELETE,
            ("file", "read"): ActivityType.FILE_READ,
            ("file", "list"): ActivityType.FILE_LIST,
            ("file", "write"): ActivityType.FILE_WRITE,
            ("web", "fetch"): ActivityType.WEB_FETCH,
            ("web", "search"): ActivityType.WEB_SEARCH,
        }
        return type_map.get((tool, action), ActivityType.TOOL_EXECUTED)
    
    def add_listener(self, callback: Callable[[ActivityEntry], None]):
        """Add a real-time listener for activity updates."""
        self._listeners.append(callback)
    
    def remove_listener(self, callback: Callable[[ActivityEntry], None]):
        """Remove a real-time listener."""
        if callback in self._listeners:
            self._listeners.remove(callback)
    
    def get_recent(self, user_id: str, limit: int = 50) -> List[ActivityEntry]:
        """Get recent activity for a user."""
        user_entries = [e for e in self._entries if e.user_id == user_id]
        return user_entries[-limit:]
    
    def get_all_recent(self, limit: int = 50) -> List[ActivityEntry]:
        """Get recent activity for all users."""
        return self._entries[-limit:]
    
    def get_by_type(self, user_id: str, activity_type: ActivityType, limit: int = 50) -> List[ActivityEntry]:
        """Get activity by type for a user."""
        filtered = [e for e in self._entries if e.user_id == user_id and e.type == activity_type]
        return filtered[-limit:]
    
    def clear(self, user_id: Optional[str] = None):
        """Clear activity log, optionally for a specific user."""
        if user_id:
            self._entries = [e for e in self._entries if e.user_id != user_id]
        else:
            self._entries = []
        self._save()
