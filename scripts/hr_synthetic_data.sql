-- HR Analytics Synthetic Data
-- Creates tables for: employees, departments, attrition, pulse surveys, L&D, recognition

-- Drop existing tables if they exist
DROP TABLE IF EXISTS recognition CASCADE;
DROP TABLE IF EXISTS learning_development CASCADE;
DROP TABLE IF EXISTS pulse_survey_responses CASCADE;
DROP TABLE IF EXISTS pulse_surveys CASCADE;
DROP TABLE IF EXISTS attrition CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS job_levels CASCADE;

-- ============================================
-- Reference Tables
-- ============================================

CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    region VARCHAR(50) NOT NULL
);

INSERT INTO locations (city, country, region) VALUES
('New York', 'USA', 'North America'),
('San Francisco', 'USA', 'North America'),
('Chicago', 'USA', 'North America'),
('London', 'UK', 'Europe'),
('Berlin', 'Germany', 'Europe'),
('Singapore', 'Singapore', 'Asia Pacific'),
('Mumbai', 'India', 'Asia Pacific'),
('Sydney', 'Australia', 'Asia Pacific'),
('Toronto', 'Canada', 'North America'),
('Dubai', 'UAE', 'Middle East');

CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL,
    cost_center VARCHAR(20) NOT NULL
);

INSERT INTO departments (department_name, cost_center) VALUES
('Engineering', 'CC100'),
('Product', 'CC101'),
('Sales', 'CC200'),
('Marketing', 'CC201'),
('Human Resources', 'CC300'),
('Finance', 'CC301'),
('Operations', 'CC400'),
('Customer Success', 'CC401'),
('Legal', 'CC500'),
('Data Science', 'CC102');

CREATE TABLE job_levels (
    level_id SERIAL PRIMARY KEY,
    level_name VARCHAR(50) NOT NULL,
    level_code VARCHAR(10) NOT NULL,
    min_salary DECIMAL(12,2),
    max_salary DECIMAL(12,2)
);

INSERT INTO job_levels (level_name, level_code, min_salary, max_salary) VALUES
('Individual Contributor 1', 'IC1', 50000, 70000),
('Individual Contributor 2', 'IC2', 65000, 90000),
('Individual Contributor 3', 'IC3', 85000, 120000),
('Senior Individual Contributor', 'IC4', 110000, 160000),
('Staff', 'IC5', 150000, 220000),
('Manager', 'M1', 100000, 150000),
('Senior Manager', 'M2', 140000, 200000),
('Director', 'D1', 180000, 280000),
('Senior Director', 'D2', 250000, 350000),
('Vice President', 'VP', 300000, 500000);

-- ============================================
-- Core Employee Table (Headcount)
-- ============================================

CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    employee_code VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department_id INTEGER REFERENCES departments(department_id),
    location_id INTEGER REFERENCES locations(location_id),
    level_id INTEGER REFERENCES job_levels(level_id),
    job_title VARCHAR(150) NOT NULL,
    hire_date DATE NOT NULL,
    birth_date DATE,
    gender VARCHAR(20),
    salary DECIMAL(12,2),
    manager_id INTEGER REFERENCES employees(employee_id),
    employment_type VARCHAR(50) DEFAULT 'Full-time',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate 500 employees with realistic distribution
INSERT INTO employees (employee_code, first_name, last_name, email, department_id, location_id, level_id, job_title, hire_date, birth_date, gender, salary, employment_type, is_active)
SELECT
    'EMP' || LPAD(n::text, 5, '0'),
    (ARRAY['James','John','Robert','Michael','William','David','Richard','Joseph','Thomas','Christopher','Sarah','Jessica','Emily','Ashley','Samantha','Amanda','Elizabeth','Jennifer','Michelle','Stephanie','Alex','Jordan','Taylor','Morgan','Casey','Riley','Quinn','Avery','Peyton','Cameron'])[1 + (random() * 29)::int],
    (ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Anderson','Taylor','Thomas','Moore','Jackson','Martin','Lee','Thompson','White','Harris','Clark','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Hill'])[1 + (random() * 29)::int],
    'employee' || n || '@company.com',
    1 + (random() * 9)::int,
    1 + (random() * 9)::int,
    CASE
        WHEN random() < 0.35 THEN 1 + (random() * 2)::int  -- 35% IC1-IC3
        WHEN random() < 0.65 THEN 3 + (random() * 2)::int  -- 30% IC3-IC5
        WHEN random() < 0.85 THEN 6 + (random() * 1)::int  -- 20% M1-M2
        ELSE 8 + (random() * 2)::int                        -- 15% D1-VP
    END,
    (ARRAY['Software Engineer','Senior Software Engineer','Staff Engineer','Product Manager','Senior Product Manager','Sales Representative','Account Executive','Marketing Specialist','HR Business Partner','Financial Analyst','Operations Manager','Customer Success Manager','Data Scientist','UX Designer','Technical Lead','Engineering Manager','Sales Director','Marketing Director','VP Engineering','Chief of Staff'])[1 + (random() * 19)::int],
    DATE '2018-01-01' + (random() * 2500)::int,
    DATE '1970-01-01' + (random() * 15000)::int,
    (ARRAY['Male','Female','Non-binary','Prefer not to say'])[1 + (random() * 3)::int],
    50000 + (random() * 200000)::int,
    (ARRAY['Full-time','Full-time','Full-time','Full-time','Part-time','Contract'])[1 + (random() * 5)::int],
    CASE WHEN random() < 0.92 THEN true ELSE false END
FROM generate_series(1, 500) AS n;

-- Set some managers (employees with level >= 6)
UPDATE employees e
SET manager_id = (
    SELECT employee_id
    FROM employees m
    WHERE m.level_id >= 6
    AND m.department_id = e.department_id
    AND m.employee_id != e.employee_id
    ORDER BY random()
    LIMIT 1
)
WHERE level_id < 6;

-- ============================================
-- Attrition Table
-- ============================================

CREATE TABLE attrition (
    attrition_id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(employee_id),
    termination_date DATE NOT NULL,
    termination_type VARCHAR(50) NOT NULL,
    termination_reason VARCHAR(200),
    exit_interview_completed BOOLEAN DEFAULT false,
    rehire_eligible BOOLEAN DEFAULT true,
    severance_weeks INTEGER,
    last_performance_rating DECIMAL(3,2),
    tenure_months INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate attrition records for ~80 employees (historical exits)
INSERT INTO attrition (employee_id, termination_date, termination_type, termination_reason, exit_interview_completed, rehire_eligible, severance_weeks, last_performance_rating, tenure_months)
SELECT
    e.employee_id,
    e.hire_date + ((random() * 1000)::int || ' days')::interval,
    (ARRAY['Voluntary','Voluntary','Voluntary','Involuntary','Retirement','Layoff'])[1 + (random() * 5)::int],
    (ARRAY['Better opportunity','Relocation','Career change','Performance','Personal reasons','Compensation','Work-life balance','Management','Company culture','Return to school'])[1 + (random() * 9)::int],
    random() < 0.7,
    random() < 0.8,
    CASE WHEN random() < 0.3 THEN (random() * 12)::int ELSE NULL END,
    2.0 + (random() * 3)::numeric(3,2),
    (random() * 60)::int
FROM employees e
WHERE e.is_active = false
LIMIT 80;

-- ============================================
-- Pulse Survey Tables
-- ============================================

CREATE TABLE pulse_surveys (
    survey_id SERIAL PRIMARY KEY,
    survey_name VARCHAR(200) NOT NULL,
    survey_date DATE NOT NULL,
    survey_quarter VARCHAR(10),
    survey_year INTEGER,
    is_anonymous BOOLEAN DEFAULT true,
    response_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pulse_surveys (survey_name, survey_date, survey_quarter, survey_year, response_rate) VALUES
('Q1 2023 Engagement Survey', '2023-03-15', 'Q1', 2023, 78.5),
('Q2 2023 Engagement Survey', '2023-06-15', 'Q2', 2023, 82.3),
('Q3 2023 Engagement Survey', '2023-09-15', 'Q3', 2023, 79.1),
('Q4 2023 Engagement Survey', '2023-12-15', 'Q4', 2023, 85.2),
('Q1 2024 Engagement Survey', '2024-03-15', 'Q1', 2024, 81.7),
('Q2 2024 Engagement Survey', '2024-06-15', 'Q2', 2024, 83.9),
('Q3 2024 Engagement Survey', '2024-09-15', 'Q3', 2024, 80.5),
('Q4 2024 Engagement Survey', '2024-12-15', 'Q4', 2024, 86.1);

CREATE TABLE pulse_survey_responses (
    response_id SERIAL PRIMARY KEY,
    survey_id INTEGER REFERENCES pulse_surveys(survey_id),
    employee_id INTEGER REFERENCES employees(employee_id),
    department_id INTEGER REFERENCES departments(department_id),
    engagement_score INTEGER CHECK (engagement_score BETWEEN 1 AND 10),
    satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 10),
    manager_effectiveness INTEGER CHECK (manager_effectiveness BETWEEN 1 AND 10),
    work_life_balance INTEGER CHECK (work_life_balance BETWEEN 1 AND 10),
    career_growth INTEGER CHECK (career_growth BETWEEN 1 AND 10),
    compensation_fairness INTEGER CHECK (compensation_fairness BETWEEN 1 AND 10),
    team_collaboration INTEGER CHECK (team_collaboration BETWEEN 1 AND 10),
    company_direction INTEGER CHECK (company_direction BETWEEN 1 AND 10),
    would_recommend_company BOOLEAN,
    comments TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate survey responses for each survey
INSERT INTO pulse_survey_responses (survey_id, employee_id, department_id, engagement_score, satisfaction_score, manager_effectiveness, work_life_balance, career_growth, compensation_fairness, team_collaboration, company_direction, would_recommend_company)
SELECT
    s.survey_id,
    e.employee_id,
    e.department_id,
    LEAST(10, GREATEST(1, 5 + (random() * 6 - 2)::int)),
    LEAST(10, GREATEST(1, 5 + (random() * 6 - 2)::int)),
    LEAST(10, GREATEST(1, 6 + (random() * 5 - 2)::int)),
    LEAST(10, GREATEST(1, 5 + (random() * 6 - 2)::int)),
    LEAST(10, GREATEST(1, 5 + (random() * 6 - 2)::int)),
    LEAST(10, GREATEST(1, 5 + (random() * 6 - 3)::int)),
    LEAST(10, GREATEST(1, 6 + (random() * 5 - 2)::int)),
    LEAST(10, GREATEST(1, 6 + (random() * 5 - 2)::int)),
    random() < 0.72
FROM pulse_surveys s
CROSS JOIN employees e
WHERE e.is_active = true AND random() < 0.82;

-- ============================================
-- Learning & Development Table
-- ============================================

CREATE TABLE learning_development (
    training_id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(employee_id),
    course_name VARCHAR(200) NOT NULL,
    course_category VARCHAR(100),
    provider VARCHAR(100),
    start_date DATE,
    completion_date DATE,
    status VARCHAR(50) DEFAULT 'In Progress',
    score DECIMAL(5,2),
    credit_hours DECIMAL(5,2),
    cost DECIMAL(10,2),
    is_mandatory BOOLEAN DEFAULT false,
    certification_earned BOOLEAN DEFAULT false,
    certification_expiry DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate L&D records
INSERT INTO learning_development (employee_id, course_name, course_category, provider, start_date, completion_date, status, score, credit_hours, cost, is_mandatory, certification_earned)
SELECT
    e.employee_id,
    (ARRAY[
        'Leadership Fundamentals', 'Advanced Python Programming', 'Project Management Professional',
        'Data Analytics with SQL', 'Effective Communication', 'Agile Methodology',
        'Cloud Architecture (AWS)', 'Machine Learning Basics', 'Conflict Resolution',
        'Financial Modeling', 'Sales Excellence', 'Customer Success Strategies',
        'Diversity & Inclusion', 'Cybersecurity Awareness', 'Time Management',
        'Public Speaking', 'Strategic Thinking', 'Design Thinking',
        'Emotional Intelligence', 'Negotiation Skills', 'Business Writing',
        'Excel Advanced', 'Tableau Visualization', 'Product Management 101',
        'UX Research Methods', 'Compliance Training', 'Safety Training',
        'First Aid & CPR', 'Anti-Harassment Training', 'Data Privacy (GDPR)'
    ])[1 + (random() * 29)::int],
    (ARRAY['Leadership', 'Technical', 'Compliance', 'Soft Skills', 'Professional Development', 'Safety'])[1 + (random() * 5)::int],
    (ARRAY['LinkedIn Learning', 'Coursera', 'Udemy', 'Internal', 'External Vendor', 'University Partner'])[1 + (random() * 5)::int],
    DATE '2023-01-01' + (random() * 700)::int,
    CASE WHEN random() < 0.75 THEN DATE '2023-01-01' + (random() * 730)::int ELSE NULL END,
    (ARRAY['Completed', 'Completed', 'Completed', 'In Progress', 'Not Started'])[1 + (random() * 4)::int],
    CASE WHEN random() < 0.75 THEN 60 + (random() * 40)::int ELSE NULL END,
    1 + (random() * 40)::int,
    50 + (random() * 2000)::int,
    random() < 0.25,
    random() < 0.3
FROM employees e
CROSS JOIN generate_series(1, 3) AS course_num
WHERE random() < 0.7;

-- ============================================
-- Recognition Table
-- ============================================

CREATE TABLE recognition (
    recognition_id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(employee_id),
    recognized_by INTEGER REFERENCES employees(employee_id),
    recognition_date DATE NOT NULL,
    recognition_type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    points_awarded INTEGER,
    monetary_value DECIMAL(10,2),
    message TEXT,
    is_public BOOLEAN DEFAULT true,
    department_id INTEGER REFERENCES departments(department_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate recognition records
INSERT INTO recognition (employee_id, recognized_by, recognition_date, recognition_type, category, points_awarded, monetary_value, message, is_public, department_id)
SELECT
    e.employee_id,
    (SELECT employee_id FROM employees WHERE employee_id != e.employee_id ORDER BY random() LIMIT 1),
    DATE '2023-01-01' + (random() * 730)::int,
    (ARRAY['Spot Bonus', 'Peer Recognition', 'Manager Recognition', 'Team Award', 'Innovation Award', 'Customer Hero', 'Values Champion', 'Quarterly MVP', 'Annual Excellence', 'Service Anniversary'])[1 + (random() * 9)::int],
    (ARRAY['Teamwork', 'Innovation', 'Customer Focus', 'Leadership', 'Excellence', 'Integrity', 'Going Above & Beyond'])[1 + (random() * 6)::int],
    50 + (random() * 500)::int,
    CASE WHEN random() < 0.3 THEN 100 + (random() * 900)::int ELSE NULL END,
    (ARRAY[
        'Outstanding work on the Q4 project delivery!',
        'Thank you for going above and beyond to help the team.',
        'Your innovative solution saved us weeks of work.',
        'Excellent customer feedback - you truly represent our values.',
        'Great leadership during a challenging sprint.',
        'Your mentorship has made a real difference.',
        'Exceptional problem-solving skills demonstrated.',
        'Thank you for always being a team player.'
    ])[1 + (random() * 7)::int],
    random() < 0.9,
    e.department_id
FROM employees e
CROSS JOIN generate_series(1, 2) AS recognition_num
WHERE e.is_active = true AND random() < 0.6;

-- ============================================
-- Create useful views
-- ============================================

CREATE OR REPLACE VIEW v_headcount_by_department AS
SELECT
    d.department_name,
    COUNT(*) as total_employees,
    COUNT(*) FILTER (WHERE e.is_active = true) as active_employees,
    COUNT(*) FILTER (WHERE e.is_active = false) as inactive_employees,
    ROUND(AVG(e.salary)::numeric, 2) as avg_salary,
    COUNT(*) FILTER (WHERE e.gender = 'Female') as female_count,
    COUNT(*) FILTER (WHERE e.gender = 'Male') as male_count
FROM employees e
JOIN departments d ON e.department_id = d.department_id
GROUP BY d.department_name;

CREATE OR REPLACE VIEW v_attrition_metrics AS
SELECT
    DATE_TRUNC('month', a.termination_date) as month,
    d.department_name,
    COUNT(*) as terminations,
    COUNT(*) FILTER (WHERE a.termination_type = 'Voluntary') as voluntary,
    COUNT(*) FILTER (WHERE a.termination_type = 'Involuntary') as involuntary,
    ROUND(AVG(a.tenure_months)::numeric, 1) as avg_tenure_months
FROM attrition a
JOIN employees e ON a.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.department_id
GROUP BY DATE_TRUNC('month', a.termination_date), d.department_name;

CREATE OR REPLACE VIEW v_engagement_trends AS
SELECT
    s.survey_quarter,
    s.survey_year,
    d.department_name,
    ROUND(AVG(r.engagement_score)::numeric, 2) as avg_engagement,
    ROUND(AVG(r.satisfaction_score)::numeric, 2) as avg_satisfaction,
    ROUND(AVG(r.manager_effectiveness)::numeric, 2) as avg_manager_score,
    ROUND(AVG(r.work_life_balance)::numeric, 2) as avg_wlb,
    COUNT(*) as response_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE r.would_recommend_company = true) / NULLIF(COUNT(*), 0), 1) as enps
FROM pulse_survey_responses r
JOIN pulse_surveys s ON r.survey_id = s.survey_id
JOIN departments d ON r.department_id = d.department_id
GROUP BY s.survey_quarter, s.survey_year, d.department_name;

CREATE OR REPLACE VIEW v_learning_summary AS
SELECT
    d.department_name,
    l.course_category,
    COUNT(*) as total_enrollments,
    COUNT(*) FILTER (WHERE l.status = 'Completed') as completed,
    ROUND(AVG(l.score)::numeric, 1) as avg_score,
    SUM(l.credit_hours) as total_hours,
    SUM(l.cost) as total_cost
FROM learning_development l
JOIN employees e ON l.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.department_id
GROUP BY d.department_name, l.course_category;

-- ============================================
-- Summary Statistics
-- ============================================

SELECT 'Tables Created Successfully!' as status;
SELECT 'employees' as table_name, COUNT(*) as row_count FROM employees
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'locations', COUNT(*) FROM locations
UNION ALL SELECT 'job_levels', COUNT(*) FROM job_levels
UNION ALL SELECT 'attrition', COUNT(*) FROM attrition
UNION ALL SELECT 'pulse_surveys', COUNT(*) FROM pulse_surveys
UNION ALL SELECT 'pulse_survey_responses', COUNT(*) FROM pulse_survey_responses
UNION ALL SELECT 'learning_development', COUNT(*) FROM learning_development
UNION ALL SELECT 'recognition', COUNT(*) FROM recognition;
