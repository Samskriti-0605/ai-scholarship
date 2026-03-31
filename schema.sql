CREATE DATABASE IF NOT EXISTS scholarship_db;
USE scholarship_db;

CREATE TABLE Students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    income DECIMAL(10,2) NOT NULL,
    marks DECIMAL(5,2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    course VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    scholarship_status ENUM('NONE', 'APPROVED') DEFAULT 'NONE'
);

CREATE TABLE Scholarships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    eligibility_criteria TEXT,
    amount DECIMAL(10,2) NOT NULL
);

CREATE TABLE Applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    scholarship_id INT NOT NULL,
    status ENUM('PENDING', 'VERIFIED', 'FLAGGED', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    fraud_score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
    FOREIGN KEY (scholarship_id) REFERENCES Scholarships(id) ON DELETE CASCADE
);

CREATE TABLE Documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    doc_type ENUM('income', 'marksheet', 'id') NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    is_digilocker BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
);

-- Insert sample scholarships
INSERT INTO Scholarships (name, description, eligibility_criteria, amount) VALUES 
('Merit Scholarship', 'For students with excellent marks.', 'Marks > 90', 50000.00),
('Low Income Grant', 'For students from economically weaker sections.', 'Income < 100000', 30000.00),
('General Scholarship', 'For general students pursuing higher education.', 'None', 15000.00),
('National Merit Excellence Award', 'Prestigious award for top academic performers nationwide.', 'Marks > 90', 75000.00),
('State General Development Fund', 'State sponsored assistance for students across all streams.', 'None', 20000.00),
('Tech Innovators Merit Grant', 'For outstanding students pursuing technical education.', 'Marks > 90', 60000.00),
('Community Low Income Support', 'Additional community-backed support for underprivileged backgrounds.', 'Income < 100000', 25000.00);
