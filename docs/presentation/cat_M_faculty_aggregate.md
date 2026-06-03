# Category M — Faculty Aggregate

**Role:** `faculty`  
**Login:** `faculty@pes.edu`  
**Purpose:** Faculty querying anonymised aggregate statistics about students.  
**Queries tested:** 45

---

## 1. AF0269 — ✅ PASS

**Query:** `how many students are enrolled in my courses?`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
No specific enrollment records for your courses were found in your profile. This may mean the data has not been uploaded yet or you do not have enrollment records in the system.
```

---

## 2. AF0270 — ✅ PASS

**Query:** `average GPA of students in my class`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
The estimated average CGPA for the MCA 2024 batch is approximately 7.8. 

Source: Faculty Performance Summary — MCA Program.
```

---

## 3. AF0271 — ✅ PASS

**Query:** `what is the grade distribution in my course?`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `0`

**Response:**

```
The grade distribution for the MCA program is as follows:

<table>
  <tr>
    <th><strong>Grade Category</strong></th>
    <th><strong>Percentage of Students</strong></th>
    <th><strong>Estimated Number of Students</strong></th>
  </tr>
  <tr>
    <td>High performers (CGPA ≥ 8.5)</td>
    <td>~25%</td>
    <td>~87 students</td>
  </tr>
  <tr>
    <td>Mid performers (CGPA 7.0–8.4)</td>
    <td>~50%</td>
    <td>~175 students</td>
  </tr>
  <tr>
    <td>Lower performers (CGPA < 7.0)</td>
    <td>~25%</td>
    <td>~88 students</td>
  </tr>
  <tr>
    <td>Grade A students (70-79%)</td>
    <td>~32%</td>
    <td>N/A</td>
  </tr>
  <tr>
    <td>Grade O/A+ (distinction/first class)</td>
    <td>~25%</td>
    <td>N/A</td>
  </tr>
</table>

Note: The estimated number of students is based on a tot
... [truncated — see full response in UI]
```

---

## 4. AF0272 — ✅ PASS

**Query:** `how many students scored above 8 CGPA in my class?`  
**Test User SRN/ID:** `FAC_MCA004`  
**Confidence:** `0`

**Response:**

```
Approximately 122 students scored above a CGPA of 8 in your class, which represents around 35% of the cohort. 

Source: Faculty Aggregate Record.
```

---

## 5. AF0273 — ✅ PASS

**Query:** `what is the class average for semester 1?`  
**Test User SRN/ID:** `FAC_MCA005`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Semester</strong></th>
    <th><strong>Class Average</strong></th>
    <th><strong>Grade Range</strong></th>
    <th><strong>Subjects</strong></th>
  </tr>
  <tr>
    <td>Semester 1</td>
    <td>Approximately 72%</td>
    <td>Grade A range</td>
    <td>Data Structures, Networks, OS, DBMS, Discrete Math</td>
  </tr>
</table>

Source: Faculty Performance Summary — MCA Program.
```

---

## 6. AF0274 — ✅ PASS

**Query:** `show student performance distribution for my course`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
I can only show your own records. For privacy reasons, I cannot retrieve or display another student's data. Try asking about your own records instead.
```

---

## 7. AF0275 — ✅ PASS

**Query:** `how many students passed in my subject?`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
No specific subject pass records were found in your profile. This may mean the data has not been uploaded yet or you do not have subject-specific pass records in the system. 

However, the estimated pass rate for core subjects is approximately 85-92%, and for electives, it is approximately 90-95%. If you need more detailed information about a specific subject, please refer to the department timetable or academic records. 

Source: Faculty Aggregate Record.
```

---

## 8. AF0276 — ✅ PASS

**Query:** `what percentage of students scored above 75%?`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `0`

**Response:**

```
To determine the percentage of students who scored above 75%, we can analyze the class averages provided for each semester:

- **Semester 1**: Class average approximately 72% (Grade A range).
- **Semester 2**: Class average approximately 74% (Grade A range).
- **Semester 3**: Class average approximately 76% (Grade A to A+ range).
- **Semester 4**: Class average approximately 78% (Grade A+ range).

From this data, we can infer the following:

- In **Semester 3**, approximately 76% of students scored above 75%.
- In **Semester 4**, approximately 78% of students scored above 75%.

Given that the average performance improves over the semesters, we can estimate that a significant portion of students in Semesters 3 and 4 scored above 75%. 

However, the exact percentage of students scoring above
... [truncated — see full response in UI]
```

---

## 9. AF0277 — ✅ PASS

**Query:** `overall class performance for this semester`  
**Test User SRN/ID:** `FAC_MCA004`  
**Confidence:** `0.983`

**Response:**

```
No class performance records were found in your profile. This may mean the data has not been uploaded yet or you do not have class performance records in the system.
```

---

## 10. AF0278 — ✅ PASS

**Query:** `how many students failed in my course?`  
**Test User SRN/ID:** `FAC_MCA005`  
**Confidence:** `0`

**Response:**

```
I can only show your own records. For privacy reasons, I cannot retrieve or display another student's data. Try asking about your own records instead.
```

---

## 11. AF0279 — ✅ PASS

**Query:** `show me the pass rate for my subject`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
The estimated pass rate for your subjects in the MCA program is as follows:

- **Core subjects**: approximately 85-92%
- **Electives**: approximately 90-95%

For specific subjects, the typical failure rates are:
- **Data Structures**: ~8% fail rate
- **Discrete Mathematics**: ~10% fail rate

Source: Faculty Aggregate Record.
```

---

## 12. AF0280 — ✅ PASS

**Query:** `number of students with distinction in my class`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
Based on the approximate distribution of grades for the MCA cohort, around 20-25% of the 350 enrolled students are estimated to have achieved a distinction (O/A+ grade, ≥80%). This translates to approximately 77 students in your class.

<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Number of Students</strong></th>
  </tr>
  <tr>
    <td>Students with Distinction (O/A+ grade)</td>
    <td>≈ 77</td>
  </tr>
</table>

Source: Faculty Aggregate Record.
```

---

## 13. AF0281 — ✅ PASS

**Query:** `median CGPA for students in MCA program`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `0`

**Response:**

```
The estimated median CGPA for students in the MCA program is between 7.5 and 8.0. 

Source: Faculty Performance Summary.
```

---

## 14. AF0282 — ✅ PASS

**Query:** `grade breakdown for Data Structures course`  
**Test User SRN/ID:** `FAC_MCA004`  
**Confidence:** `0`

**Response:**

```
No grade records were found in your profile for the Data Structures course. This may mean the data has not been uploaded yet or you do not have grade records in the system.
```

---

## 15. AF0283 — ✅ PASS

**Query:** `average marks in my subject this semester`  
**Test User SRN/ID:** `FAC_MCA005`  
**Confidence:** `0`

**Response:**

```
To provide you with the average marks for your subject this semester, I need to know which specific subject you are referring to. Please specify the subject name or course title.
```

---

## 16. AF0284 — ✅ PASS

**Query:** `number of students scoring A grade in my course`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
The approximate number of students scoring an A grade (70-79%) in your course is estimated to be around 112 students, based on the overall grade distribution for the MCA cohort.

Source: Faculty Aggregate Record.
```

---

## 17. AF0285 — ✅ PASS

**Query:** `class statistics for Machine Learning course`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
No class statistics records were found in your profile for the Machine Learning course. This may mean the data has not been uploaded yet or you do not have class statistics for this course in the system.
```

---

## 18. AF0286 — ✅ PASS

**Query:** `how many students are in my department?`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `0`

**Response:**

```
There are 350 students enrolled in your department (Department of MCA). 

Source: Faculty Aggregate Record.
```

---

## 19. AF0287 — ✅ PASS

**Query:** `overall placement rate for my students`  
**Test User SRN/ID:** `FAC_MCA004`  
**Confidence:** `0`

**Response:**

```
The overall placement rate for your students is 15.4%. 

Source: Placement Aggregate Record.
```

---

## 20. AF0288 — ✅ PASS

**Query:** `how many of my students got internships?`  
**Test User SRN/ID:** `FAC_MCA005`  
**Confidence:** `0.995`

**Response:**

```
No internship records were found in your profile. This may mean the data has not been uploaded yet or you do not have internship records in the system.
```

---

## 21. AF0289 — ✅ PASS

**Query:** `class performance trend across semesters`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `1`

**Response:**

```
No marks records were found in your profile. This may mean the data has not been uploaded yet or you do not have marks records in the system.
```

---

## 22. AF0290 — ✅ PASS

**Query:** `average attendance rate in my course`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
No attendance records were found in your profile. This may mean the data has not been uploaded yet or you do not have attendance records in the system.
```

---

## 23. AF0291 — ✅ PASS

**Query:** `number of students who scored O grade`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `0`

**Response:**

```
No specific records regarding the number of students who scored an O grade were found in your profile. This may mean the data has not been uploaded yet or you do not have grading records in the system.
```

---

## 24. AF0292 — ✅ PASS

**Query:** `how many first class students are in my batch?`  
**Test User SRN/ID:** `FAC_MCA004`  
**Confidence:** `0`

**Response:**

```
To determine the number of first-class students in your batch, we can refer to the estimated distribution of CGPA among the enrolled students. 

Approximately 25% of the cohort is estimated to achieve a distinction or first-class (Grade O/A+). Given that there are 350 enrolled students in the MCA program:

- First-class students = 25% of 350 = 0.25 * 350 = 87.5

Since we cannot have a fraction of a student, we can round this to approximately 88 first-class students in your batch.

**Summary:**
Approximately 88 students in your batch are classified as first-class students.

Source: Faculty Performance Summary — MCA Program.
```

---

## 25. AF0293 — ✅ PASS

**Query:** `grade statistics for Advanced Algorithms course`  
**Test User SRN/ID:** `FAC_MCA005`  
**Confidence:** `0`

**Response:**

```
🔒 **Privacy Protection Active**

You cannot access another student's records. This system enforces strict data isolation — each user can only view their own data.

If you need information about your own records, try queries like:
- "give me my details"
- "my placement details"
- "my semester marks"

_This access attempt has been logged for security audit._
```

---

## 26. AF0294 — ✅ PASS

**Query:** `placement percentage for students I teach`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
The placement percentage for the students you teach is 15.4%. 

This is calculated based on the total number of placed students (54) out of the total enrolled students (350). 

Source: Faculty Aggregate Record.
```

---

## 27. AF0295 — ✅ PASS

**Query:** `which course has the highest average marks?`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
The course with the highest average marks is **Machine Learning**, which has an average rating of **4.8 out of 5** in student satisfaction. 

Source: Faculty Aggregate Record.
```

---

## 28. AF0296 — ✅ PASS

**Query:** `student count by performance band`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `0`

**Response:**

```
Here is the estimated student count by performance band based on the provided aggregate data:

<table>
  <tr>
    <th><strong>Performance Band</strong></th>
    <th><strong>Estimated Student Count</strong></th>
  </tr>
  <tr>
    <td>High performers (CGPA ≥8.5)</td>
    <td>≈ 87 students (~25%)</td>
  </tr>
  <tr>
    <td>Mid performers (CGPA 7.0–8.4)</td>
    <td>≈ 175 students (~50%)</td>
  </tr>
  <tr>
    <td>Lower performers (CGPA <7.0)</td>
    <td>≈ 88 students (~25%)</td>
  </tr>
</table>

These estimates are based on typical MCA cohort statistics. Exact counts require individual record access.
```

---

## 29. AF0297 — ✅ PASS

**Query:** `semester 2 average marks across all subjects`  
**Test User SRN/ID:** `FAC_MCA004`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Semester</strong></th>
    <th><strong>Class Average</strong></th>
    <th><strong>Subjects</strong></th>
  </tr>
  <tr>
    <td>Semester 2</td>
    <td>Approximately 74%</td>
    <td>ML, Cloud Computing, Software Engineering, Algorithms</td>
  </tr>
</table>

Source: Faculty Performance Summary — MCA Program
```

---

## 30. AF0298 — ✅ PASS

**Query:** `how many students improved from sem 1 to sem 2?`  
**Test User SRN/ID:** `FAC_MCA005`  
**Confidence:** `0`

**Response:**

```
Approximately 60% of the enrolled students improved their grades from Semester 1 to Semester 2. Given that there are 350 enrolled students, this translates to about 210 students who showed grade improvement across the semesters.

Source: Faculty Performance Summary.
```

---

## 31. AF0299 — ✅ PASS

**Query:** `list courses with below average performance`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
Based on the provided context, the courses with below average performance can be identified from the class averages for each semester. The average performance across the semesters is as follows:

- Semester 1 class average: approximately 72%
- Semester 2 class average: approximately 74%
- Semester 3 class average: approximately 76%
- Semester 4 class average: approximately 78%

Since all semester averages are above 70%, there are no courses listed that fall below average performance. 

**Summary:**
No courses with below average performance were identified in the MCA program. 

Source: Faculty Performance Summary — MCA Program.
```

---

## 32. AF0300 — ✅ PASS

**Query:** `top performing course in MCA this semester`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
The top performing course in the MCA program this semester (Semester 4) is indicated by the class average of approximately 78%, which falls within the Grade A+ range. This semester is dissertation-based, and it is noted that most students score higher during this period.

Source: Faculty Performance Summary — MCA Program.
```

---

## 33. AF0301 — ✅ PASS

**Query:** `distribution of students by CGPA range`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `0`

**Response:**

```
Here is the distribution of students by CGPA range for the MCA program:

<table>
  <tr>
    <th><strong>CGPA Range</strong></th>
    <th><strong>Number of Students</strong></th>
    <th><strong>Percentage of Cohort</strong></th>
  </tr>
  <tr>
    <td>High performers (CGPA ≥ 8.5)</td>
    <td>Approximately 87 students</td>
    <td>~25%</td>
  </tr>
  <tr>
    <td>Mid performers (CGPA 7.0–8.4)</td>
    <td>Approximately 175 students</td>
    <td>~50%</td>
  </tr>
  <tr>
    <td>Lower performers (CGPA < 7.0)</td>
    <td>Approximately 88 students</td>
    <td>~25%</td>
  </tr>
</table>

Source: Faculty Performance Summary — MCA Program.
```

---

## 34. AF0302 — ✅ PASS

**Query:** `how many students are in 8-9 CGPA bracket?`  
**Test User SRN/ID:** `FAC_MCA004`  
**Confidence:** `0`

**Response:**

```
Approximately 122 students are in the 8-9 CGPA range, which represents about 35% of the cohort. 

Source: Faculty Aggregate Record.
```

---

## 35. AF0303 — ✅ PASS

**Query:** `subject-wise failure rate this semester`  
**Test User SRN/ID:** `FAC_MCA005`  
**Confidence:** `0`

**Response:**

```
The estimated subject-wise failure rates for this semester are as follows:

| Subject                  | Estimated Failure Rate |
|--------------------------|------------------------|
| Data Structures          | ~8%                    |
| Discrete Mathematics      | ~10%                   |

Note: The overall pass rate per subject is estimated to be around 85-92% for core subjects and 90-95% for electives. Individual student pass/fail records are in private academic files.
```

---

## 36. AF0304 — ✅ PASS

**Query:** `performance comparison between sections`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `1`

**Response:**

```
No performance records were found in your profile. This may mean the data has not been uploaded yet or you do not have performance records in the system.
```

---

## 37. AF0305 — ✅ PASS

**Query:** `top 3 courses by student satisfaction`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
Here are the top 3 courses by student satisfaction in the MCA program:

<table>
  <tr>
    <th>Course</th>
    <th>Average Rating</th>
  </tr>
  <tr>
    <td>Machine Learning</td>
    <td>4.8/5</td>
  </tr>
  <tr>
    <td>Cloud Computing</td>
    <td>4.7/5</td>
  </tr>
  <tr>
    <td>Data Structures</td>
    <td>4.6/5</td>
  </tr>
</table>

Source: Faculty Aggregate Record.
```

---

## 38. AF0306 — ✅ PASS

**Query:** `number of students who completed all assignments`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `0`

**Response:**

```
Approximately 297 out of 350 enrolled students completed all assignments. 

Source: Faculty Aggregate Record.
```

---

## 39. AF0307 — ✅ PASS

**Query:** `internship conversion rate for my students`  
**Test User SRN/ID:** `FAC_MCA004`  
**Confidence:** `0`

**Response:**

```
No internship records were found in your profile. This may mean the data has not been uploaded yet or you do not have internship records in the system.
```

---

## 40. AF0308 — ✅ PASS

**Query:** `what courses are offered in semester 3?`  
**Test User SRN/ID:** `FAC_MCA005`  
**Confidence:** `0`

**Response:**

```
The courses offered in Semester 3 of the MCA program are elective-heavy, where students can choose from 3-4 elective courses out of 6-8 options. The specific elective courses typically offered include:

- IoT
- Blockchain
- Big Data
- NLP (Natural Language Processing)
- Cybersecurity

Source: Curriculum Information (MCA Program)
```

---

## 41. AF0309 — ✅ PASS

**Query:** `which semester has the highest workload?`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
The semester with the highest workload is Semester 4, which involves a dissertation and viva voce, requiring full-time project engagement.
```

---

## 42. AF0310 — ✅ PASS

**Query:** `average CGPA for MCA 2024 batch`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
The estimated average CGPA for the MCA 2024 batch is approximately 7.8. 

Source: Faculty Performance Summary — MCA Program.
```

---

## 43. AF0311 — ✅ PASS

**Query:** `student distribution by specialization`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `0`

**Response:**

```
The student distribution by specialization in the MCA program is as follows:

<table>
  <tr>
    <th>Specialization</th>
    <th>Percentage of Students</th>
  </tr>
  <tr>
    <td>Data Science</td>
    <td>~35%</td>
  </tr>
  <tr>
    <td>Cloud Computing</td>
    <td>~30%</td>
  </tr>
  <tr>
    <td>Cybersecurity</td>
    <td>~20%</td>
  </tr>
  <tr>
    <td>Full Stack Development</td>
    <td>~15%</td>
  </tr>
</table>

Source: Faculty Aggregate Record.
```

---

## 44. AF0312 — ✅ PASS

**Query:** `how many elective courses are offered?`  
**Test User SRN/ID:** `FAC_MCA004`  
**Confidence:** `0`

**Response:**

```
Typically, 6-8 elective courses are offered in the MCA program. 

Source: Faculty Aggregate Record.
```

---

## 45. AF0313 — ✅ PASS

**Query:** `total credit hours for MCA program`  
**Test User SRN/ID:** `FAC_MCA005`  
**Confidence:** `0`

**Response:**

```
The total credit hours for the MCA program are approximately 80-90 credits across the program. 

Source: Faculty Aggregate Record.
```

---
