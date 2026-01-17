import logging 
import typer
from . import memory_manager 


# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = typer.Typer()

def main():
    memory_manager.initialize_memory_db() 
    app()

if __name__ == "__main__":
    main()
