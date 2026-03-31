import sqlite3

def add_scholarships():
    conn = sqlite3.connect('scholarship.db')
    cursor = conn.cursor()
    
    scholarships = [
        ('National Merit Excellence Award', 'Prestigious award for top academic performers nationwide.', 'Marks > 90', 75000.00),
        ('State General Development Fund', 'State sponsored assistance for students across all streams.', 'None', 20000.00),
        ('Tech Innovators Merit Grant', 'For outstanding students pursuing technical education.', 'Marks > 90', 60000.00),
        ('Community Low Income Support', 'Additional community-backed support for underprivileged backgrounds.', 'Income < 100000', 25000.00)
    ]
    
    for sch in scholarships:
        # Check if already exists to prevent duplicate inserts if user runs it multiple times
        cursor.execute("SELECT id FROM Scholarships WHERE name=?", (sch[0],))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO Scholarships (name, description, eligibility_criteria, amount) VALUES (?, ?, ?, ?)", sch)
            print(f"Added {sch[0]}")
            
    conn.commit()
    conn.close()

if __name__ == '__main__':
    add_scholarships()
