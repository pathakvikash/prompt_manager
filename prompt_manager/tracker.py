import datetime
import json
import os
from collections import Counter, defaultdict
from typing import List, Dict, Any, Optional, Union

from .storage import JSONStorage
import logging

logger = logging.getLogger(__name__)

class EventType:
    # Top-level event categories
    CHAT_SESSION = "chat_session"
    COMMAND = "command"
    WEB_ACTION = "web_action"

    # Sub-event types for commands
    IMPROVE_COMMAND = "improve_command"
    UNDERSTAND_COMMAND = "understand_command"
    REFACTOR_COMMAND = "refactor_command"
    EVALUATE_PROMPT_COMMAND = "evaluate_prompt_command"

    # Sub-event types for prompt actions
    PROMPT_ADD_ACTION = "prompt_add_action"
    PROMPT_EDIT_ACTION = "prompt_edit_action"
    PROMPT_DELETE_ACTION = "prompt_delete_action"
    PROMPT_GET_ACTION = "prompt_get_action" # Added for completeness of web actions
    PROMPT_LIST_ACTION = "prompt_list_action" # Added for completeness of web actions
    PROMPT_SEARCH_ACTION = "prompt_search_action" # Added for completeness of web actions

    # Sub-event types for chat
    CHAT_MESSAGE = "chat_message"

class BaseEvent:
    def __init__(self, event_type: str, timestamp: datetime.datetime, details: Optional[Dict[str, Any]] = None, sub_events: Optional[List['BaseEvent']] = None):
        self.event_type = event_type
        self.timestamp = timestamp
        self.details = details if details is not None else {}
        self.sub_events = sub_events if sub_events is not None else []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
            "sub_events": [sub_event.to_dict() for sub_event in self.sub_events]
        }

    @property
    def session_id(self) -> Optional[str]:
        return self.details.get("session_id")

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BaseEvent':
        event = cls(
            event_type=data["event_type"],
            timestamp=datetime.datetime.fromisoformat(data["timestamp"]),
            details=data.get("details", {}),
            sub_events=[cls.from_dict(item) for item in data.get("sub_events", [])]
        )
        return event

class ChatEvent(BaseEvent):
    def __init__(self, timestamp: datetime.datetime, message: str, role: str):
        super().__init__(EventType.CHAT_MESSAGE, timestamp, {"message": message, "role": role})

class CommandEvent(BaseEvent):
    def __init__(self, command_type: str, timestamp: datetime.datetime, details: Optional[Dict[str, Any]] = None, sub_events: Optional[List[BaseEvent]] = None):
        super().__init__(command_type, timestamp, details, sub_events)

class WebActionEvent(BaseEvent):
    def __init__(self, action_type: str, timestamp: datetime.datetime, details: Optional[Dict[str, Any]] = None, sub_events: Optional[List[BaseEvent]] = None):
        super().__init__(action_type, timestamp, details, sub_events)

class Tracker:
    def __init__(self, storage_file: str = "tracking.json"):
        self.storage = JSONStorage(storage_file)
        self.events: List[BaseEvent] = self._load_events()

    def _load_events(self) -> List[BaseEvent]:
        data = self.storage.load()
        if not isinstance(data, list):
             logger.warning(f"Unexpected data format in tracking storage. Expected list, got {type(data)}.")
             return []
        loaded_events = []
        for item in data:
            try:
                loaded_events.append(BaseEvent.from_dict(item))
            except Exception as e:
                logger.warning(f"Skipping invalid event data: {e}")
        return loaded_events

    def _save_events(self):
        self.storage.save([item.to_dict() for item in self.events])

    def record_chat_session(self, user_id: str, messages: List[Dict[str, str]], session_id: Optional[str] = None):
        """Records a complete chat session as a single event."""
        session_events = [ChatEvent(datetime.datetime.now(), msg["content"], msg["role"]) for msg in messages]
        chat_session = BaseEvent(
            event_type=EventType.CHAT_SESSION,
            timestamp=datetime.datetime.now(),
            details={"user_id": user_id, "session_id": session_id},
            sub_events=session_events
        )
        self.events.append(chat_session)
        self._save_events()

    def record_command_event(self, user_id: str, command_type: str, details: Optional[Dict[str, Any]] = None, sub_events: Optional[List[BaseEvent]] = None):
        """Records a command event with optional sub-events."""
        command = CommandEvent(
            command_type=command_type,
            timestamp=datetime.datetime.now(),
            details={"user_id": user_id, **(details if details is not None else {})},
            sub_events=sub_events
        )
        self.events.append(command)
        self._save_events()

    def record_web_action(self, user_id: str, action_type: str, details: Optional[Dict[str, Any]] = None, sub_events: Optional[List[BaseEvent]] = None):
        """Records a web action event with optional sub-events."""
        web_action = WebActionEvent(
            action_type=action_type,
            timestamp=datetime.datetime.now(),
            details={"user_id": user_id, **(details if details is not None else {})},
            sub_events=sub_events
        )
        self.events.append(web_action)
        self._save_events()

    def record_chat_message(self, user_id: str, message: str, role: str, session_id: Optional[str] = None):
        """Records a single chat message for a user, isolated by session_id if provided."""
        chat_event = ChatEvent(datetime.datetime.now(), message, role)
        
        # If session_id is provided, try to find that specific session
        if session_id:
            for event in reversed(self.events):
                if event.event_type == EventType.CHAT_SESSION and event.details.get("session_id") == session_id:
                    # Double check user_id for security
                    if event.details.get("user_id") == user_id:
                        event.sub_events.append(chat_event)
                        self._save_events()
                        return
                    else:
                        logger.warning(f"Session ID {session_id} requested by user {user_id} but owned by {event.details.get('user_id')}")

        # If no session_id or session not found, create a new one
        new_session = BaseEvent(
            event_type=EventType.CHAT_SESSION,
            timestamp=datetime.datetime.now(),
            details={"user_id": user_id, "session_id": session_id},
            sub_events=[chat_event]
        )
        self.events.append(new_session)
        self._save_events()

    def clear_events_by_type(self, event_type: str):
        self.events = [event for event in self.events if event.event_type != event_type]
        self._save_events()

    def clear_events(self, user_id: str, event_type: Optional[str] = None, before_date: Optional[datetime.datetime] = None):
        """Granularly clears events based on criteria."""
        new_events = []
        for event in self.events:
            # Keep the event if it's for a different user
            if event.details.get("user_id") != user_id:
                new_events.append(event)
                continue
            
            # Filter matches
            matches_type = event_type is None or event.event_type == event_type or (event_type == "web_action" and event.event_type.startswith("prompt_"))
            matches_date = before_date is None or event.timestamp < before_date
            
            # If it matches both (or is None), we DON'T add it to new_events (clearing it)
            if matches_type and matches_date:
                continue
            
            new_events.append(event)
        
        self.events = new_events
        self._save_events()

    def delete_session(self, user_id: str, session_id: str):
        """Permanently deletes a chat session."""
        # Try exact match first
        found = False
        for e in self.events:
            if e.event_type == EventType.CHAT_SESSION and e.details.get("user_id") == user_id and e.details.get("session_id") == session_id:
                found = True
                break
        
        if found:
            self.events = [e for e in self.events if not (e.event_type == EventType.CHAT_SESSION and e.details.get("session_id") == session_id and e.details.get("user_id") == user_id)]
        else:
            # Fallback: if not found by ID, try deleting the first id-less session for this user
            new_events = []
            deleted = False
            for e in self.events:
                if not deleted and e.event_type == EventType.CHAT_SESSION and e.details.get("user_id") == user_id and not e.details.get("session_id"):
                    deleted = True
                    continue
                new_events.append(e)
            self.events = new_events
        
        self._save_events()

    def delete_message(self, user_id: str, session_id: str, message_index: int):
        """Permanently deletes a specific message from a session."""
        # Try exact match first
        for event in self.events:
            if event.event_type == EventType.CHAT_SESSION and event.details.get("user_id") == user_id and event.details.get("session_id") == session_id:
                if 0 <= message_index < len(event.sub_events):
                    event.sub_events.pop(message_index)
                    self._save_events()
                    return True
                return False
        
        # Fallback: if not found by ID, try matching sessions with NO ID for this user
        for event in self.events:
            if event.event_type == EventType.CHAT_SESSION and event.details.get("user_id") == user_id and not event.details.get("session_id"):
                if 0 <= message_index < len(event.sub_events):
                    event.sub_events.pop(message_index)
                    self._save_events()
                    return True
        return False

    def reset(self):
        self.events = []
        self._save_events()

class ReportGenerator:
    def __init__(self, tracker: Tracker):
        self.tracker = tracker

    def get_interaction_summary(self) -> dict:
        total_events = len(self.tracker.events)
        event_counts = Counter(item.event_type for item in self.tracker.events)
        return {"total_events": total_events, "event_counts": dict(event_counts)}

    def get_chat_history_report(self) -> list[dict]:
        chat_sessions_report = []
        for event in self.tracker.events:
            if event.event_type == EventType.CHAT_SESSION:
                session_details = {
                    "user_id": event.details.get("user_id"),
                    "session_id": event.details.get("session_id"),
                    "timestamp": event.timestamp.isoformat(),
                    "messages": []
                }
                for sub_event in event.sub_events:
                    if sub_event.event_type == EventType.CHAT_MESSAGE:
                        session_details["messages"].append({
                            "role": sub_event.details.get("role"),
                            "content": sub_event.details.get("message"),
                            "timestamp": sub_event.timestamp.isoformat()
                        })
                chat_sessions_report.append(session_details)
        return chat_sessions_report

    def get_command_report(self) -> list[dict]:
        command_reports = []
        for event in self.tracker.events:
            if event.event_type == EventType.COMMAND:
                command_report = {
                    "command_type": event.details.get("command_type", "unknown"),
                    "user_id": event.details.get("user_id"),
                    "timestamp": event.timestamp.isoformat(),
                    "details": event.details,
                    "sub_events": [sub_event.to_dict() for sub_event in event.sub_events]
                }
                command_reports.append(command_report)
        return command_reports

    def get_web_action_report(self) -> list[dict]:
        web_action_reports = []
        for event in self.tracker.events:
            if event.event_type == EventType.WEB_ACTION:
                web_action_report = {
                    "action_type": event.details.get("action_type", "unknown"),
                    "user_id": event.details.get("user_id"),
                    "timestamp": event.timestamp.isoformat(),
                    "details": event.details,
                    "sub_events": [sub_event.to_dict() for sub_event in event.sub_events]
                }
                web_action_reports.append(web_action_report)
        return web_action_reports
