from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
from werkzeug.utils import secure_filename
from ai_ocr import analyze_document

app = Flask(__name__)
CORS(app)

DB_NAME = 'scholarship.db'
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Dummy Database for DigiLocker matches
DUMMY_DIGILOCKER_DB = {
    # 7 Global Aadhaar Numbers (Access to all)
    "111111111111": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "222222222222": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "333333333333": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "444444444444": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "555555555555": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "666666666666": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "777777777777": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "659035984247": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "659035984742": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "659035894247": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "123412341234": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    "987698769876": ["income", "marksheet_10", "marksheet_12", "first_graduate"],
    
    # 7 Income Certificate IDs
    "INC1000001": ["income"],
    "INC1000002": ["income"],
    "INC1000003": ["income"],
    "INC1000004": ["income"],
    "INC1000005": ["income"],
    "INC1000006": ["income"],
    "INC1000007": ["income"],
    "TM-4201233026": ["income"],
    "TM-420XXX3026": ["income"],

    # 7 10th Marksheet IDs
    "TEN1000001": ["marksheet_10"],
    "TEN1000002": ["marksheet_10"],
    "TEN1000003": ["marksheet_10"],
    "TEN1000004": ["marksheet_10"],
    "TEN1000005": ["marksheet_10"],
    "TEN1000006": ["marksheet_10"],
    "TEN1000007": ["marksheet_10"],
    "20283848": ["marksheet_10"],

    # 7 12th Marksheet IDs
    "TWL1000001": ["marksheet_12"],
    "TWL1000002": ["marksheet_12"],
    "TWL1000003": ["marksheet_12"],
    "TWL1000004": ["marksheet_12"],
    "TWL1000005": ["marksheet_12"],
    "TWL1000006": ["marksheet_12"],
    "TWL1000007": ["marksheet_12"],
    "33208534": ["marksheet_12"],
}

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def get_db_connection():
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    conn.row_factory = dict_factory
    return conn

@app.route('/')
def home():
    return jsonify({"status": "Backend is running"})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    role = data.get('role', 'student')
    
    if not data.get('student_id') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'ID, Name, and Password are required!'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM Students WHERE student_id = ?", (data['student_id'],))
        if cursor.fetchone():
            return jsonify({'error': 'User ID already exists'}), 400

        email = data.get('email', f"{data['student_id']}@system.com")
        phone = data.get('phone', '')
        income = data.get('income') or 0
        marks = data.get('marks') or 0
        category = data.get('category', 'N/A')
        course = data.get('course', 'N/A')
        state = data.get('state', 'N/A')

        sql = """INSERT INTO Students (student_id, name, email, phone, password, income, marks, category, course, state, role)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
        cursor.execute(sql, (
            data['student_id'], data['name'], email, phone, data['password'],
            float(income), float(marks), category, course, state, role
        ))
        conn.commit()
        return jsonify({'message': f'{role.capitalize()} Registration successful'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    student_id = data.get('student_id')
    password = data.get('password')
    role = data.get('role', 'student')

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Students WHERE student_id = ? AND password = ? AND role = ?", (student_id, password, role))
        user = cursor.fetchone()
        
        if user:
            del user['password']
            return jsonify({'role': user['role'], 'student': user, 'message': 'Login successful'})
        else:
            return jsonify({'error': 'Invalid credentials or wrong role selected'}), 401
    finally:
        conn.close()

@app.route('/api/student/<int:id>', methods=['GET'])
def get_student(id):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Students WHERE id = ?", (id,))
        student = cursor.fetchone()
        if student:
            del student['password']
            return jsonify(student)
        return jsonify({'error': 'Not found'}), 404
    finally:
        conn.close()

@app.route('/api/student/<int:id>/profile-status', methods=['GET'])
def get_profile_status(id):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT ai_trust_score, mismatch_attempts, has_ongoing_scholarship FROM Students WHERE id = ?", (id,))
        student = cursor.fetchone()
        if not student: return jsonify({'error': 'Not found'}), 404
        
        cursor.execute("SELECT doc_type, is_digilocker FROM Documents WHERE student_id = ?", (id,))
        rows = cursor.fetchall()
        docs = [r['doc_type'] for r in rows]
        digilocker_docs = [r['doc_type'] for r in rows if r.get('is_digilocker')]
        
        return jsonify({
            'has_ongoing_scholarship': student['has_ongoing_scholarship'],
            'ai_trust_score': student['ai_trust_score'],
            'mismatch_attempts': student['mismatch_attempts'],
            'uploaded_docs': docs,
            'digilocker_docs': digilocker_docs
        })
    finally:
        conn.close()

@app.route('/api/student/update-profile', methods=['POST'])
def update_profile():
    data = request.json
    student_id = data.get('student_id')
    ongoing = data.get('has_ongoing_scholarship')
    
    if student_id is None or ongoing is None:
        return jsonify({'error': 'Missing data'}), 400
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Students SET has_ongoing_scholarship = ? WHERE id = ?", (int(ongoing), student_id))
        conn.commit()
        return jsonify({'message': 'Profile updated'})
    finally:
        conn.close()

@app.route('/api/get-recommendation', methods=['POST'])
def get_recommendation():
    data = request.json
    income = float(data.get('income', 0))
    marks = float(data.get('marks', 0))

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Scholarships")
        scholarships = cursor.fetchall()
        
        recommended = []
        for sch in scholarships:
            if ("Merit" in sch['name'] or "Tech" in sch['name']) and marks >= 90:
                recommended.append(sch)
            elif ("Low Income" in sch['name'] or "Community" in sch['name']) and income <= 100000:
                recommended.append(sch)
            elif "General" in sch['name'] or "State" in sch['name']:
                recommended.append(sch)

        return jsonify({'recommendations': recommended})
    finally:
        conn.close()

@app.route('/api/apply-scholarship', methods=['POST'])
def apply_scholarship():
    data = request.json
    student_id = data.get('student_id')
    scholarship_id = data.get('scholarship_id')

    if not student_id or not scholarship_id:
        return jsonify({'error': 'student_id and scholarship_id are required'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT scholarship_status FROM Students WHERE id = ?", (student_id,))
        student = cursor.fetchone()
        if student and student['scholarship_status'] == 'APPROVED':
            return jsonify({'error': 'You already have an approved scholarship.'}), 400

        cursor.execute("SELECT id FROM Applications WHERE student_id = ? AND scholarship_id = ?", (student_id, scholarship_id))
        if cursor.fetchone():
            return jsonify({'error': 'Already applied for this scholarship'}), 400

        sql = "INSERT INTO Applications (student_id, scholarship_id, status) VALUES (?, ?, 'PENDING')"
        cursor.execute(sql, (student_id, scholarship_id))
        app_id = cursor.lastrowid
        
        cursor.execute("UPDATE Documents SET is_locked = 1 WHERE student_id = ?", (student_id,))
        conn.commit()
        return jsonify({'message': 'Application submitted successfully', 'application_id': app_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/scholarships', methods=['POST'])
def create_scholarship():
    data = request.json
    name = data.get('name')
    description = data.get('description', '')
    eligibility_criteria = data.get('eligibility_criteria', '')
    amount = data.get('amount')
    
    if not name or not amount:
        return jsonify({'error': 'Name and amount are required'}), 400
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''INSERT INTO Scholarships (name, description, eligibility_criteria, amount) 
                          VALUES (?, ?, ?, ?)''', (name, description, eligibility_criteria, float(amount)))
        conn.commit()
        return jsonify({'message': 'Scholarship created successfully', 'id': cursor.lastrowid}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/upload-document', methods=['POST'])
def upload_document():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
        
    file = request.files['file']
    student_id = request.form.get('student_id')
    doc_type = request.form.get('doc_type') 
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if not student_id or not doc_type:
        return jsonify({'error': 'student_id and doc_type required'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT is_locked FROM Documents WHERE student_id = ? AND is_locked = 1 LIMIT 1", (student_id,))
        if cursor.fetchone():
            return jsonify({'error': 'Documents are locked for an active application'}), 400

        filename = secure_filename(file.filename)
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            return jsonify({'error': 'Invalid file format. Please upload an image (PNG, JPG, JPEG) for OCR verification.'}), 400
            
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{student_id}_{doc_type}_{filename}")
        file.save(filepath)

        cursor.execute("SELECT name, income, marks, mismatch_attempts, ai_trust_score FROM Students WHERE id = ?", (student_id,))
        student_data = cursor.fetchone()
        
        score, category = analyze_document(filepath, student_data, doc_type)
        
        if category == "High Risk":
            attempts = student_data.get('mismatch_attempts', 0)
            new_attempts = attempts + 1
            if attempts == 0:
                cursor.execute("UPDATE Students SET mismatch_attempts = ? WHERE id = ?", (new_attempts, student_id))
                conn.commit()
                return jsonify({'error': 'Data Mismatch Warning: Your uploaded text does not match registration criteria. A second attempt will be flagged as malpractice.', 'mismatch_warning': True, 'level': 1}), 400
            else:
                new_trust_score = max(0, student_data.get('ai_trust_score', 100) - 20)
                cursor.execute("UPDATE Students SET mismatch_attempts = ?, ai_trust_score = ? WHERE id = ?", (new_attempts, new_trust_score, student_id))
                conn.commit()
                return jsonify({'error': f'Malpractice Detected: Document verification failed. 20 points deducted from your AI Trust Score!', 'mismatch_warning': True, 'level': 2, 'trust_score': new_trust_score}), 400

        cursor.execute("SELECT id FROM Documents WHERE student_id = ? AND doc_type = ?", (student_id, doc_type))
        existing = cursor.fetchone()
        if existing:
            cursor.execute("UPDATE Documents SET file_path = ? WHERE id = ?", (filepath, existing['id']))
        else:
            cursor.execute("INSERT INTO Documents (student_id, doc_type, file_path) VALUES (?, ?, ?)",
                           (student_id, doc_type, filepath))
                           
        conn.commit()
        return jsonify({'message': f'Document {doc_type} verified and securely stored successfully.', 'trust_score': student_data.get('ai_trust_score', 100)})
    except Exception as e:
        # Pass Tesseract error completely through to UI natively for testing
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/digilocker/fetch', methods=['POST'])
def digilocker_fetch():
    data = request.json
    student_id = data.get('student_id')
    doc_type = data.get('doc_type')
    digilocker_id = data.get('digilocker_id')

    if not student_id or not doc_type or not digilocker_id:
        return jsonify({'error': 'student_id, doc_type, and DigiLocker ID / Aadhaar required'}), 400

    # Dummy Database Match Logic
    user_docs = DUMMY_DIGILOCKER_DB.get(str(digilocker_id))
    if not user_docs:
        return jsonify({'error': "Data doesn't match! Invalid DigiLocker ID or Aadhaar."}), 400
    
    if doc_type not in user_docs:
        return jsonify({'error': f"Document '{doc_type}' not found in your DigiLocker account."}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT is_locked FROM Documents WHERE student_id = ? AND is_locked = 1 LIMIT 1", (student_id,))
        if cursor.fetchone():
            return jsonify({'error': 'Documents are locked for an active application'}), 400

        filepath = f"digilocker_verified_{doc_type}.pdf"

        cursor.execute("SELECT id FROM Documents WHERE student_id = ? AND doc_type = ?", (student_id, doc_type))
        existing = cursor.fetchone()
        if existing:
            cursor.execute("UPDATE Documents SET file_path = ?, is_digilocker = 1 WHERE id = ?", (filepath, existing['id']))
        else:
            cursor.execute("INSERT INTO Documents (student_id, doc_type, file_path, is_digilocker) VALUES (?, ?, ?, 1)",
                           (student_id, doc_type, filepath))
                           
        conn.commit()
        
        cursor.execute("SELECT ai_trust_score FROM Students WHERE id = ?", (student_id,))
        score = cursor.fetchone()['ai_trust_score']
        
        return jsonify({'message': f'{doc_type} fetched securely from DigiLocker! Verification skipped.', 'trust_score': score})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/get-status/<int:student_id>', methods=['GET'])
def get_status(student_id):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        sql = """SELECT a.id, a.status, a.fraud_score, s.name as scholarship_name 
                 FROM Applications a JOIN Scholarships s ON a.scholarship_id = s.id 
                 WHERE a.student_id = ?"""
        cursor.execute(sql, (student_id,))
        apps = cursor.fetchall()
        return jsonify({'applications': apps})
    finally:
        conn.close()

@app.route('/api/admin/applications', methods=['GET'])
def get_all_applications():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        sql = """SELECT a.id, a.status, a.fraud_score, a.created_at, 
                        st.name as student_name, st.student_id as reg_no,
                        sch.name as scholarship_name 
                 FROM Applications a 
                 JOIN Students st ON a.student_id = st.id 
                 JOIN Scholarships sch ON a.scholarship_id = sch.id"""
        cursor.execute(sql)
        return jsonify({'applications': cursor.fetchall()})
    finally:
        conn.close()

@app.route('/api/admin/review', methods=['POST'])
def review_application():
    data = request.json
    app_id = data.get('application_id')
    action = data.get('action') 

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if action == 'approve':
            cursor.execute("UPDATE Applications SET status = 'PROVIDER_PENDING' WHERE id = ?", (app_id,))
        elif action == 'reject':
            cursor.execute("UPDATE Applications SET status = 'REJECTED' WHERE id = ?", (app_id,))
        conn.commit()
        return jsonify({'message': f'Application {action}d successfully'})
    finally:
        conn.close()

@app.route('/api/admin/unlock-documents/<int:student_id>', methods=['POST'])
def unlock_documents(student_id):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Documents SET is_locked = 0 WHERE student_id = ?", (student_id,))
        conn.commit()
        return jsonify({'message': 'Documents unlocked successfully'})
    finally:
        conn.close()

@app.route('/api/provider/final-approval', methods=['POST'])
def provider_final_approval():
    data = request.json
    app_id = data.get('application_id')
    action = data.get('action') 

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT student_id FROM Applications WHERE id = ?", (app_id,))
        app_record = cursor.fetchone()
        if not app_record:
            return jsonify({'error': 'Application not found'}), 404
            
        student_id = app_record['student_id']

        if action == 'approve':
            cursor.execute("UPDATE Applications SET status = 'APPROVED' WHERE id = ?", (app_id,))
            cursor.execute("UPDATE Applications SET status = 'REJECTED' WHERE student_id = ? AND id != ?", (student_id, app_id))
            cursor.execute("UPDATE Students SET scholarship_status = 'APPROVED' WHERE id = ?", (student_id,))
        elif action == 'reject':
            cursor.execute("UPDATE Applications SET status = 'REJECTED' WHERE id = ?", (app_id,))
        conn.commit()
        return jsonify({'message': f'Final {action} successful'})
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
