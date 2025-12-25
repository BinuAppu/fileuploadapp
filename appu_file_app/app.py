import os
from flask import Flask, render_template, request, send_from_directory, jsonify
from werkzeug.utils import secure_filename
import mimetypes

app = Flask(__name__)
# Set upload folder to current working directory
UPLOAD_FOLDER = os.getcwd()
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/files')
def list_files():
    req_path = request.args.get('path', '')
    if req_path == 'root':
        req_path = ''
    
    abs_path = os.path.join(app.config['UPLOAD_FOLDER'], req_path)
    
    # Security check to prevent traversing up out of the directory
    if not os.path.commonpath([app.config['UPLOAD_FOLDER'], abs_path]) == app.config['UPLOAD_FOLDER']:
         return jsonify({'error': 'Access denied'}), 403

    if not os.path.exists(abs_path):
        return jsonify({'error': 'Path not found'}), 404

    files = []
    if os.path.isdir(abs_path):
        for item in os.listdir(abs_path):
            item_path = os.path.join(abs_path, item)
            is_dir = os.path.isdir(item_path)
            try:
                size = os.path.getsize(item_path)
            except OSError:
                size = 0
            
            files.append({
                'name': item,
                'is_dir': is_dir,
                'path': os.path.join(req_path, item),
                'size': size
            })
    return jsonify({'files': files, 'current_path': req_path})

@app.route('/api/download')
def download_file():
    req_path = request.args.get('path', '')
    return send_from_directory(app.config['UPLOAD_FOLDER'], req_path, as_attachment=True)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    files = request.files.getlist('file')
    saved_files = []
    
    if not files or files[0].filename == '':
        return jsonify({'error': 'No selected file'}), 400

    for file in files:
        if file:
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            saved_files.append(filename)
            
    return jsonify({'success': True, 'filenames': saved_files})

if __name__ == '__main__':
    print(f"Starting server in {UPLOAD_FOLDER}")
    app.run(host='0.0.0.0', port=8000, debug=True)
