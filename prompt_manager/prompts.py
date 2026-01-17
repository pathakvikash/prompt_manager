import logging
from typing import List, Dict, Optional
from .storage import PromptStorage

# Configure logging
logger = logging.getLogger(__name__)

class Prompt:
    def __init__(self, name: str, content: str, category: str = "Uncategorized", tags: Optional[List[str]] = None):
        if not name or not name.strip():
            raise ValueError("Prompt name cannot be empty.")
        if not content or not content.strip():
            raise ValueError("Prompt content cannot be empty.")
            
        self.name = name.strip()
        self.content = content
        self.category = category
        self.tags = tags if tags is not None else []

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "content": self.content,
            "category": self.category,
            "tags": self.tags
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'Prompt':
        return cls(
            name=data["name"],
            content=data["content"],
            category=data.get("category", "Uncategorized"),
            tags=data.get("tags", [])
        )

class PromptManager:
    def __init__(self, storage_file: str = "prompts.json"):
        self.storage = PromptStorage(storage_file)
        self.prompts: Dict[str, Prompt] = self._load_prompts()

    def _load_prompts(self) -> Dict[str, Prompt]:
        data = self.storage.load_prompts()
        loaded_prompts = {}
        if not isinstance(data, dict): # Basic validation for the loaded structure
             logger.warning(f"Unexpected data format in storage. Expected dict, got {type(data)}.")
             return {}

        for prompt_data in data.values():
            try:
                prompt = Prompt.from_dict(prompt_data)
                loaded_prompts[prompt.name] = prompt
            except ValueError as e:
                logger.warning(f"Skipping invalid prompt data: {e}")
        return loaded_prompts

    def _save_prompts(self):
        prompts_data = {prompt.name: prompt.to_dict() for prompt in self.prompts.values()}
        self.storage.save_prompts(prompts_data)

    def add_prompt(self, prompt: Prompt):
        if prompt.name in self.prompts:
            raise ValueError(f"Prompt with name '{prompt.name}' already exists.")
        self.prompts[prompt.name] = prompt
        self._save_prompts()

    def get_prompt(self, name: str) -> Optional[Prompt]:
        # Perform case-insensitive lookup
        name_lower = name.lower()
        for prompt_name, prompt_obj in self.prompts.items():
            if prompt_name.lower() == name_lower:
                return prompt_obj
        return None

    def update_prompt(self, name: str, new_content: Optional[str] = None, new_category: Optional[str] = None, new_tags: Optional[List[str]] = None):
        # Find the prompt with case-insensitive matching
        prompt_to_update = None
        name_lower = name.lower()
        for pn, p_obj in self.prompts.items():
            if pn.lower() == name_lower:
                prompt_to_update = p_obj
                break

        if not prompt_to_update:
            raise ValueError(f"Prompt with name '{name}' not found.")
        
        if new_content is not None: # Check for None explicitly to allow empty strings if intended (though Prompt init forbids it)
             if not new_content.strip():
                 raise ValueError("Content cannot be empty.")
             prompt_to_update.content = new_content

        if new_category:
            prompt_to_update.category = new_category
        if new_tags is not None:
            prompt_to_update.tags = new_tags
        self._save_prompts()

    def delete_prompt(self, name: str):
        # Find the prompt with case-insensitive matching
        original_name_to_delete = None
        name_lower = name.lower()
        for pn in self.prompts.keys():
            if pn.lower() == name_lower:
                original_name_to_delete = pn
                break

        if original_name_to_delete in self.prompts:
            del self.prompts[original_name_to_delete]
            self._save_prompts()
        else:
            raise ValueError(f"Prompt with name '{name}' not found.")

    def list_prompts(self) -> List[Prompt]:
        return list(self.prompts.values())

    def search_prompts(self, query: str) -> List[Prompt]:
        query = query.lower()
        results = []
        for prompt in self.prompts.values():
            if query in prompt.name.lower() or \
               query in prompt.content.lower() or \
               query in prompt.category.lower() or \
               (prompt.tags and any(query in tag.lower() for tag in prompt.tags)):
                results.append(prompt)
        return results
