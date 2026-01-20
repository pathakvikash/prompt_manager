"""
Control layer for tool execution with permission enforcement.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Callable, Tuple
from enum import Enum
from .base import ToolAction, ToolResult, PermissionLevel, BaseTool
from .permissions import PermissionStore
import logging

logger = logging.getLogger(__name__)


class ControlDecision(Enum):
    """Decision made by the control layer."""
    APPROVE = "approve"
    DENY = "deny"
    PENDING = "pending"


@dataclass
class PendingAction:
    """An action waiting for user approval."""
    action: ToolAction
    permission_level: PermissionLevel
    created_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict:
        return {
            "request_id": self.action.request_id,
            "tool": self.action.tool_name,
            "action": self.action.action,
            "params": self.action.params,
            "user_id": self.action.user_id,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


class ControlLayer:
    """
    Controls tool execution based on permissions.
    
    Handles:
    - Permission checking before execution
    - Approval queue for CONFIRM-level actions
    - Callbacks for notifications and pending actions
    """
    
    def __init__(
        self,
        permission_store: PermissionStore,
        on_notify: Optional[Callable[[ToolAction, ToolResult], None]] = None,
        on_pending: Optional[Callable[[PendingAction], None]] = None
    ):
        self.permission_store = permission_store
        self.on_notify = on_notify
        self.on_pending = on_pending
        self._pending_actions: Dict[str, PendingAction] = {}
        self._tools: Dict[str, BaseTool] = {}
    
    def register_tool(self, tool: BaseTool):
        """Register a tool with the control layer."""
        self._tools[tool.name] = tool
        logger.info(f"Registered tool: {tool.name}")
    
    def get_registered_tools(self) -> List[str]:
        """Get list of registered tool names."""
        return list(self._tools.keys())
    
    def request_execution(self, action: ToolAction) -> Tuple[ControlDecision, Optional[ToolResult]]:
        """
        Request to execute a tool action.
        
        Returns (decision, result) where result is None if pending/denied.
        """
        tool = self._tools.get(action.tool_name)
        if not tool:
            logger.warning(f"Unknown tool requested: {action.tool_name}")
            return ControlDecision.DENY, ToolResult(
                tool_name=action.tool_name,
                action=action.action,
                success=False,
                result=None,
                error=f"Unknown tool: {action.tool_name}"
            )
        
        # Check permission
        permission = self.permission_store.get_permission(
            action.user_id,
            action.tool_name,
            action.action
        )
        
        if permission == PermissionLevel.DENY:
            logger.info(f"Denied {action.tool_name}.{action.action} for {action.user_id}")
            return ControlDecision.DENY, ToolResult(
                tool_name=action.tool_name,
                action=action.action,
                success=False,
                result=None,
                error="Action denied by permission policy",
                permission_level=permission
            )
        
        if permission == PermissionLevel.CONFIRM:
            # Queue for approval
            pending = PendingAction(action=action, permission_level=permission)
            self._pending_actions[action.request_id] = pending
            
            if self.on_pending:
                self.on_pending(pending)
            
            logger.info(f"Queued {action.tool_name}.{action.action} for approval (request_id={action.request_id})")
            return ControlDecision.PENDING, None
        
        # AUTO or NOTIFY - execute immediately
        result = self._execute_tool(tool, action)
        result.permission_level = permission
        
        if permission == PermissionLevel.NOTIFY and self.on_notify:
            self.on_notify(action, result)
        
        return ControlDecision.APPROVE, result
    
    def approve_pending(self, request_id: str) -> Optional[ToolResult]:
        """Approve a pending action and execute it."""
        pending = self._pending_actions.pop(request_id, None)
        if not pending:
            logger.warning(f"Pending action not found: {request_id}")
            return None
        
        tool = self._tools.get(pending.action.tool_name)
        if not tool:
            logger.error(f"Tool not found for pending action: {pending.action.tool_name}")
            return None
        
        logger.info(f"Approved pending action: {request_id}")
        return self._execute_tool(tool, pending.action)
    
    def deny_pending(self, request_id: str) -> bool:
        """Deny a pending action."""
        pending = self._pending_actions.pop(request_id, None)
        if pending:
            logger.info(f"Denied pending action: {request_id}")
            return True
        return False
    
    def get_pending_actions(self, user_id: str) -> List[PendingAction]:
        """Get all pending actions for a user."""
        return [
            p for p in self._pending_actions.values()
            if p.action.user_id == user_id
        ]
    
    def get_all_pending_actions(self) -> List[PendingAction]:
        """Get all pending actions."""
        return list(self._pending_actions.values())
    def _execute_tool(self, tool: BaseTool, action: ToolAction) -> ToolResult:
        """Execute a tool action and measure time."""
        start = datetime.now()
        try:
            # Clean up parameters to avoid position/keyword argument conflicts (multiple values for 'action')
            safe_params = {k: v for k, v in action.params.items() if k not in ["action", "user_id"]}
            result = tool.execute(action.action, action.user_id, **safe_params)
            result.execution_time_ms = int((datetime.now() - start).total_seconds() * 1000)
            logger.info(f"Executed {action.tool_name}.{action.action} in {result.execution_time_ms}ms")
            return result
        except Exception as e:
            logger.exception(f"Error executing {action.tool_name}.{action.action}")
            return ToolResult(
                tool_name=action.tool_name,
                action=action.action,
                success=False,
                result=None,
                error=str(e),
                execution_time_ms=int((datetime.now() - start).total_seconds() * 1000)
            )
