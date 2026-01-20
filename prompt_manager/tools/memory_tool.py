"""
Memory tool for AI to store and retrieve user context.
"""

from typing import List
from .base import BaseTool, ToolResult, ToolCategory, PermissionLevel
import logging

logger = logging.getLogger(__name__)


class MemoryTool(BaseTool):
    """
    Tool for managing user memory/context.
    
    Actions:
    - get: Retrieve user's stored details
    - set_preference: Set a single user preference (recommended for AI use)
    - get_preference: Get a single user preference
    - update: Add/update user details (bulk update)
    - delete: Clear user's memory
    """
    
    @property
    def name(self) -> str:
        return "memory"
    
    @property
    def category(self) -> ToolCategory:
        return ToolCategory.MEMORY
    
    @property
    def description(self) -> str:
        return "Store and retrieve user preferences, context, and information across sessions"
    
    def get_actions(self) -> List[str]:
        return ["get", "get_preference", "set_preference", "update", "delete"]
    
    def get_default_permission(self, action: str) -> PermissionLevel:
        return {
            "get": PermissionLevel.AUTO,
            "get_preference": PermissionLevel.AUTO,
            "set_preference": PermissionLevel.NOTIFY,
            "update": PermissionLevel.NOTIFY,
            "delete": PermissionLevel.CONFIRM,
        }.get(action, PermissionLevel.CONFIRM)
    
    def execute(self, action: str, user_id: str, **kwargs) -> ToolResult:
        # Import here to avoid circular imports
        from prompt_manager import memory_manager
        
        try:
            if action == "get":
                details = memory_manager.get_user_details(user_id)
                logger.info(f"Retrieved memory for user {user_id}")
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=True,
                    result=details
                )
            
            elif action == "get_preference":
                key = kwargs.get("key")
                if not key:
                    return ToolResult(
                        tool_name=self.name,
                        action=action,
                        success=False,
                        result=None,
                        error="'key' parameter is required for get_preference"
                    )
                preference = memory_manager.get_user_preference(user_id, key)
                logger.info(f"Retrieved preference '{key}' for user {user_id}")
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=True,
                    result={key: preference}
                )
            
            elif action == "set_preference":
                key = kwargs.get("key")
                value = kwargs.get("value")
                if not key or value is None:
                    return ToolResult(
                        tool_name=self.name,
                        action=action,
                        success=False,
                        result=None,
                        error="'key' and 'value' parameters are required for set_preference"
                    )
                memory_manager.set_user_preference(user_id, key, value)
                logger.info(f"Set preference '{key}' to '{value}' for user {user_id}")
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=True,
                    result={"key": key, "value": value}
                )
            
            elif action == "update":
                details = kwargs.get("details", {})
                
                # Check for individual key/value if details not provided
                if not details and "key" in kwargs and "value" in kwargs:
                    details = {kwargs["key"]: kwargs["value"]}

                # Fallback: if no standard format found, use all other kwargs as details
                if not details:
                    details = {k: v for k, v in kwargs.items() if k != "action"}

                if not details:
                    return ToolResult(
                        tool_name=self.name,
                        action=action,
                        success=False,
                        result=None,
                        error="No data provided for memory update"
                    )
                memory_manager.update_user_details(user_id, details)
                logger.info(f"Updated memory for user {user_id}: {list(details.keys())}")
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=True,
                    result={"updated_keys": list(details.keys())}
                )
            
            elif action == "delete":
                memory_manager.delete_user_memory(user_id)
                logger.info(f"Deleted memory for user {user_id}")
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=True,
                    result={"deleted": True}
                )
            
            else:
                return ToolResult(
                    tool_name=self.name,
                    action=action,
                    success=False,
                    result=None,
                    error=f"Unknown action: {action}"
                )
        
        except Exception as e:
            logger.exception(f"Memory tool error: {action}")
            return ToolResult(
                tool_name=self.name,
                action=action,
                success=False,
                result=None,
                error=str(e)
            )
