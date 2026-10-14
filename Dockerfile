# =======================================================================
# AI-TRAFFIC-ADAPTION Docker image for Hugging Face Spaces and AWS ECS
# =======================================================================

FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    DEBIAN_FRONTEND=noninteractive

# Install essential system libraries for OpenCV, Video I/O, and PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Run the application as a non-root user
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Pre-install CPU PyTorch wheels for fast, lightweight build
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install application dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code, pre-built frontend, models, and configurations
COPY --chown=user:user . .

# Ensure directory permissions for runtime uploads and output generation
RUN mkdir -p data/uploads outputs/videos state && \
    chown -R user:user $HOME/app

# Switch to non-root user
USER user

# Container port used by Hugging Face Spaces and the AWS ECS Express service
EXPOSE 7860

# Launch the FastAPI dashboard with REST API, WebSockets, and React SPA
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
