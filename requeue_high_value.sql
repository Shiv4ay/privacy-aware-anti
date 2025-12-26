
UPDATE documents 
SET status = 'pending', processed_at = NULL 
WHERE filename IN (
    'students.csv', 
    'results.csv', 
    'companies.csv', 
    'internships.csv', 
    'users.csv', 
    'faculty.csv', 
    'courses.csv', 
    'departments.csv', 
    'placements.csv',
    'Retrieval_Augmented_Generation.pdf',
    'test_rag.txt',
    'test_doc_org1.txt'
);
