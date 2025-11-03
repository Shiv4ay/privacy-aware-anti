import os
import zipfile
import json

# Create the complete Privacy-Aware RAG project structure
project_name = "Privacy-Aware-RAG"

# Create the main project directory structure
directories = [
    f"{project_name}",
    f"{project_name}/backend",
    f"{project_name}/backend/api",
    f"{project_name}/backend/worker", 
    f"{project_name}/backend/database",
    f"{project_name}/frontend",
    f"{project_name}/frontend/src",
    f"{project_name}/frontend/src/components",
    f"{project_name}/frontend/src/pages",
    f"{project_name}/frontend/src/hooks",
    f"{project_name}/frontend/src/utils",
    f"{project_name}/frontend/public",
    f"{project_name}/docker"
]

for directory in directories:
    os.makedirs(directory, exist_ok=True)

print("Created directory structure for Privacy-Aware RAG project")