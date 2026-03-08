import sys
import json
import csv
from app import redact_text, extract_text_from_file

csv_content = 'student_id,first_name,last_name,email,gender,date_of_birth,address\nPES1PG24CA001,Gayatri,Reddy,gayatri.pes1pg24ca001@pesu.edu.in,F,2003-02-27,\ÿ
