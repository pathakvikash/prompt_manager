"""
Base classes and types for the AI tool system.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional, List
from enum import Enum
import uuid


class PermissionLevel(Enum):
    """Permission levels for tool actions."""
    AUTO = "auto"           # Execute automatically, no approval needed
    NOTIFY = "notify"       # Execute and notify user
    CONFIRM = "confirm"     # Require user confirmation before execution
    DENY = "deny"           # Never allow this action


class ToolCategory(Enum):
    """Categories for grouping tools."""
    MEMORY = "memory"
    FILE = "file"
    WEB = "web"
    SYSTEM = "system"


@dataclass
class ToolAction:
    """Represents a requested tool action."""
    tool_name: str
    action: str
    params: Dict[str, Any]
    user_id: str
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "tool_name": self.tool_name,
            "action": self.action,
            "params": self.params,
            "user_id": self.user_id,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class ToolResult:
    """Result from tool execution."""
    tool_name: str
    action: str
    success: bool
    result: Any
    error: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    execution_time_ms: Optional[int] = None
    permission_level: PermissionLevel = PermissionLevel.AUTO
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool_name": self.tool_name,
            "action": self.action,
            "success": self.success,
            "result": self.result,
            "error": self.error,
            "timestamp": self.timestamp.isoformat(),
            "execution_time_ms": self.execution_time_ms,
            "permission_level": self.permission_level.value,
        }


class BaseTool(ABC):
    """Base class for all AI tools."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Tool identifier for logging."""
        pass
    
    @property
    @abstractmethod
    def category(self) -> ToolCategory:
        """Tool category for grouping."""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """Description for AI to understand when to use this tool."""
        pass
    
    @abstractmethod
    def get_actions(self) -> List[str]:
        """Return list of available actions."""
        pass
    
    @abstractmethod
    def get_default_permission(self, action: str) -> PermissionLevel:
        """Return default permission level for an action."""
        pass
    
    @abstractmethod
    def execute(self, action: str, user_id: str, **kwargs) -> ToolResult:
        """Execute the tool action."""
        pass
    
    def get_action_schema(self, action: str) -> Dict[str, Any]:
        """Return JSON schema for action parameters. Override for custom schemas."""
        return {}
