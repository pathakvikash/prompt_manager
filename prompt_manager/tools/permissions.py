"""
Permission management for AI tools.
"""

from dataclasses import dataclass
from typing import Dict, Optional, Tuple
from .base import PermissionLevel
import json
import os
import logging

logger = logging.getLogger(__name__)


@dataclass
class PermissionRule:
    """A permission rule for a tool action."""
    tool: str
    action: str
    level: PermissionLevel
    reason: Optional[str] = None


class PermissionStore:
    """
    Manages tool permissions per user.
    
    Permissions are stored hierarchically:
    1. User-specific overrides (highest priority)
    2. Default permissions (fallback)
    """
    
    # Default permission matrix favoring safety
    DEFAULT_PERMISSIONS: Dict[Tuple[str, str], PermissionLevel] = {
        # Memory operations
        ("memory", "get"): PermissionLevel.AUTO,
        ("memory", "update"): PermissionLevel.NOTIFY,
        ("memory", "delete"): PermissionLevel.CONFIRM,
        
        # File operations
        ("file", "read"): PermissionLevel.AUTO,
        ("file", "list"): PermissionLevel.AUTO,
        ("file", "write"): PermissionLevel.CONFIRM,
        ("file", "delete"): PermissionLevel.DENY,
        
        # Web operations
        ("web", "fetch"): PermissionLevel.CONFIRM,
        ("web", "search"): PermissionLevel.NOTIFY,
    }
    
    def __init__(self, storage_path: str = None):
        if storage_path is None:
            # Default to project root
            storage_path = os.path.join(
                os.path.dirname(__file__), "..", "..", "permissions.json"
            )
        self.storage_path = os.path.abspath(storage_path)
        self._user_overrides: Dict[str, Dict[Tuple[str, str], PermissionLevel]] = {}
        self._load()
    
    def _load(self):
        """Load user overrides from storage."""
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    # Convert stored format back to tuples
                    for user_id, perms in data.items():
                        self._user_overrides[user_id] = {
                            tuple(k.split(":")): PermissionLevel(v)
                            for k, v in perms.items()
                        }
                logger.info(f"Loaded permissions from {self.storage_path}")
            except Exception as e:
                logger.warning(f"Failed to load permissions: {e}")
                self._user_overrides = {}
    
    def _save(self):
        """Save user overrides to storage."""
        try:
            data = {
                user_id: {f"{k[0]}:{k[1]}": v.value for k, v in perms.items()}
                for user_id, perms in self._user_overrides.items()
            }
            with open(self.storage_path, 'w') as f:
                json.dump(data, f, indent=2)
            logger.debug(f"Saved permissions to {self.storage_path}")
        except Exception as e:
            logger.error(f"Failed to save permissions: {e}")
    
    def get_permission(self, user_id: str, tool: str, action: str) -> PermissionLevel:
        """Get permission level for a user's tool action."""
        key = (tool, action)
        
        # Check user-specific override first
        if user_id in self._user_overrides:
            if key in self._user_overrides[user_id]:
                return self._user_overrides[user_id][key]
        
        # Fall back to defaults
        return self.DEFAULT_PERMISSIONS.get(key, PermissionLevel.CONFIRM)
    
    def set_permission(self, user_id: str, tool: str, action: str, level: PermissionLevel):
        """Set user-specific permission override."""
        if user_id not in self._user_overrides:
            self._user_overrides[user_id] = {}
        self._user_overrides[user_id][(tool, action)] = level
        self._save()
        logger.info(f"Set permission for {user_id}: {tool}.{action} = {level.value}")
    
    def reset_permissions(self, user_id: str):
        """Reset user to default permissions."""
        if user_id in self._user_overrides:
            del self._user_overrides[user_id]
            self._save()
            logger.info(f"Reset permissions for {user_id}")
    
    def get_all_permissions(self, user_id: str) -> Dict[str, Dict[str, str]]:
        """Get all permissions for a user as a nested dict."""
        result: Dict[str, Dict[str, str]] = {}
        
        # Start with defaults
        for (tool, action), level in self.DEFAULT_PERMISSIONS.items():
            if tool not in result:
                result[tool] = {}
            result[tool][action] = level.value
        
        # Apply user overrides
        if user_id in self._user_overrides:
            for (tool, action), level in self._user_overrides[user_id].items():
                if tool not in result:
                    result[tool] = {}
                result[tool][action] = level.value
        
        return result
