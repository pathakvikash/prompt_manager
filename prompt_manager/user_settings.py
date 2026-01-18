import os
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class UserSettingsStore:
    def __init__(self, storage_path: str = "user_settings.json"):
        self.storage_path = storage_path
        self.default_settings = {
            "default_model": "llama3.1:latest",
            "temperature": 0.7,
            "num_ctx": 4096,
            "top_p": 0.9,
            "top_k": 40,
            "repeat_penalty": 1.1
        }
        self._ensure_storage()

    def _ensure_storage(self):
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, 'w') as f:
                json.dump({}, f)

    def _load_all(self) -> Dict[str, Dict[str, Any]]:
        try:
            with open(self.storage_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _save_all(self, data: Dict[str, Dict[str, Any]]):
        with open(self.storage_path, 'w') as f:
            json.dump(data, f, indent=4)

    def get_settings(self, user_id: str) -> Dict[str, Any]:
        """Get settings for a user, falling back to defaults."""
        all_settings = self._load_all()
        user_settings = all_settings.get(user_id, {})
        
        # Merge with defaults
        merged = self.default_settings.copy()
        merged.update(user_settings)
        return merged

    def update_settings(self, user_id: str, new_settings: Dict[str, Any]):
        """Update settings for a user."""
        all_settings = self._load_all()
        user_settings = all_settings.get(user_id, {})
        
        # Only allow keys that exist in defaults to prevent pollution
        for k, v in new_settings.items():
            if k in self.default_settings:
                user_settings[k] = v
        
        all_settings[user_id] = user_settings
        self._save_all(all_settings)
        logger.info(f"Updated settings for user {user_id}")

# Global instance
settings_store = UserSettingsStore()
