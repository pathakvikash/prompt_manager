import json
import os
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

class JSONStorage:
    def __init__(self, file_path: str):
        self.file_path = file_path

    def _ensure_directory(self):
        """Ensure the directory for the storage file exists."""
        dirname = os.path.dirname(self.file_path)
        if dirname:
            os.makedirs(dirname, exist_ok=True)

    def load(self) -> Any:
        """Load data from the JSON file. Returns empty dict/list if file doesn't exist."""
        if not os.path.exists(self.file_path):
            return {}
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading data from {self.file_path}: {e}")
            return {}

    def save(self, data: Any):
        """Save data to the JSON file atomically."""
        self._ensure_directory()
        try:
            #Atomic write: write to temp file then rename
            temp_file = f"{self.file_path}.tmp" 
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
            os.replace(temp_file, self.file_path)
        except IOError as e:
            logger.error(f"Error saving data to {self.file_path}: {e}")
            raise

class PromptStorage(JSONStorage):
    """Specialized storage for prompts that handles dictionary mapping."""
    def load_prompts(self) -> Dict[str, Any]:
        """Load raw prompt dictionaries."""
        return self.load() # Expecting a dict of prompts

    def save_prompts(self, prompts_data: Dict[str, Any]):
        """Save raw prompt dictionaries."""
        self.save(prompts_data)
