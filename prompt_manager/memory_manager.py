
import json
import os
import sqlite3 # Import sqlite3
import logging # Import logging

# Configure logging
logger = logging.getLogger(__name__)

MEMORY_DB = "memory.db"

def _get_memory_path():
    """Returns the path to the memory database file."""
    return os.path.join(os.path.dirname(__file__), "..", MEMORY_DB)

def _get_db_connection():
    """Establishes and returns a connection to the SQLite database."""
    conn = sqlite3.connect(_get_memory_path())
    conn.row_factory = sqlite3.Row
    return conn

def initialize_memory_db():
    """Initializes the SQLite database and creates the user_memory table if it doesn't exist."""
    conn = _get_db_connection()
    c = conn.cursor()
    # Create table to store user memory as JSON strings
    c.execute("""
        CREATE TABLE IF NOT EXISTS user_memory (
            user_id TEXT PRIMARY KEY,
            details JSON
        )
    """)
    conn.commit()
    conn.close()
    logger.info(f"Initialized memory database at {_get_memory_path()}")

def get_user_details(user_id):
    """Retrieves all details for a user from the database."""
    conn = _get_db_connection()
    c = conn.cursor()
    c.execute("SELECT details FROM user_memory WHERE user_id = ?", (user_id,))
    result = c.fetchone()
    conn.close()
    if result and result['details']:
        logger.debug(f"Retrieved details for user {user_id}.")
        return json.loads(result['details'])
    logger.debug(f"No details found for user {user_id}.")
    return {}

def update_user_details(user_id, details):
    """Updates multiple details for a user in the database."""
    conn = _get_db_connection()
    c = conn.cursor()
    
    existing_details = get_user_details(user_id)
    existing_details.update(details)
    
    try:
        c.execute("""
            INSERT OR REPLACE INTO user_memory (user_id, details)
            VALUES (?, ?)
        """, (user_id, json.dumps(existing_details)))
        
        conn.commit()
        logger.info(f"Updated memory for user {user_id}: {existing_details}")
    except sqlite3.Error as e:
        logger.error(f"SQLite error updating memory for user {user_id}: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred updating memory for user {user_id}: {e}")
    finally:
        conn.close()

def create_empty_memory_file():
    """Ensures that the memory database exists and is initialized."""
    initialize_memory_db()

def delete_user_memory(user_id: str):
    """Deletes memory for a specific user."""
    conn = _get_db_connection()
    c = conn.cursor()
    try:
        c.execute("DELETE FROM user_memory WHERE user_id = ?", (user_id,))
        conn.commit()
        logger.info(f"Deleted memory for user {user_id} from {_get_memory_path()}.")
    except sqlite3.Error as e:
        logger.error(f"SQLite error deleting memory for user {user_id}: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred deleting memory for user {user_id}: {e}")
    finally:
        conn.close()

def reset_entire_database():
    """Clears all user memory from the database."""
    conn = _get_db_connection()
    c = conn.cursor()
    try:
        c.execute("DELETE FROM user_memory")
        conn.commit()
        logger.info(f"Cleared all user memory from {_get_memory_path()}.")
    except sqlite3.Error as e:
        logger.error(f"SQLite error clearing database: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred clearing database: {e}")
    finally:
        conn.close()

# User Preference Helpers - Designed for AI to update individual preferences
def get_user_preference(user_id, key):
    """Get user preference by key."""
    details = get_user_details(user_id)
    preference = details.get(key)
    logger.debug(f"Retrieved preference '{key}' for user {user_id}: {preference}.")
    return preference

def set_user_preference(user_id, key, value):
    """Set user preference by key."""
    details = get_user_details(user_id)
    details[key] = value
    update_user_details(user_id, details)
    logger.info(f"Set preference '{key}' to '{value}' for user {user_id}.")
