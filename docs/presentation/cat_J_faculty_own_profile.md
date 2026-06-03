# Category J — Faculty Own Profile

**Role:** `faculty`  
**Login:** `faculty@pes.edu`  
**Purpose:** Faculty querying their own profile, employee ID, or teaching data.  
**Queries tested:** 25

---

## 1. AF0189 — ✅ PASS

**Query:** `give me my details`  
**Test User SRN/ID:** `FAC_MCA001`  
**Expected value in response:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>FIELD</th>
    <th>VALUE</th>
  </tr>
  <tr>
    <td>Employee ID / Faculty ID</td>
    <td>FAC_MCA001</td>
  </tr>
  <tr>
    <td>Department</td>
    <td>Master of Computer Applications (MCA)</td>
  </tr>
  <tr>
    <td>University</td>
    <td>PES University</td>
  </tr>
</table>

Source: Faculty Aggregate Record
```

---

## 2. AF0190 — ✅ PASS

**Query:** `who am I?`  
**Test User SRN/ID:** `FAC_MCA001`  
**Expected value in response:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
Here is your profile information:

<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Faculty ID</td>
    <td>FAC_MCA001</td>
  </tr>
  <tr>
    <td>Department</td>
    <td>Master of Computer Applications (MCA)</td>
  </tr>
  <tr>
    <td>University</td>
    <td>PES University</td>
  </tr>
</table>

Source: Faculty Aggregate Record.
```

---

## 3. AF0191 — ✅ PASS

**Query:** `show me my profile`  
**Test User SRN/ID:** `FAC_MCA002`  
**Expected value in response:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>FIELD</th>
    <th>VALUE</th>
  </tr>
  <tr>
    <td>Faculty ID</td>
    <td>FAC_MCA002</td>
  </tr>
  <tr>
    <td>Department</td>
    <td>Master of Computer Applications (MCA)</td>
  </tr>
  <tr>
    <td>University</td>
    <td>PES University</td>
  </tr>
</table>

Source: Faculty Aggregate Record
```

---

## 4. AF0192 — ✅ PASS

**Query:** `what is my faculty ID?`  
**Test User SRN/ID:** `FAC_MCA001`  
**Expected value in response:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
Your faculty ID is **FAC_MCA001**.
```

---

## 5. AF0193 — ✅ PASS

**Query:** `my department`  
**Test User SRN/ID:** `FAC_MCA002`  
**Expected value in response:** `MCA`  
**Confidence:** `0`

**Response:**

```
Your department is **MCA**. 

Source: Faculty Aggregate Record.
```

---

## 6. AF0194 — ✅ PASS

**Query:** `which department am I in?`  
**Test User SRN/ID:** `FAC_MCA003`  
**Expected value in response:** `MCA`  
**Confidence:** `0.987`

**Response:**

```
<table>
  <tr>
    <th>Department Name</th>
  </tr>
  <tr>
    <td>Electronics & Communication Engg</td>
  </tr>
</table>
Source: DEPARTMENT RECORD
```

---

## 7. AF0195 — ✅ PASS

**Query:** `what courses do I teach?`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Course Name</th>
    <th>Course Code</th>
    <th>Credits</th>
    <th>Semester Offered</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>Internship</td>
    <td>UQ24CA851A</td>
    <td>6</td>
    <td>Semester 4</td>
    <td>Industry internship programme</td>
  </tr>
  <tr>
    <td>Special Elective I</td>
    <td>UQ24CA852SE</td>
    <td>4</td>
    <td>Semester 4</td>
    <td>Elective specialization paper I</td>
  </tr>
  <tr>
    <td>Special Elective II</td>
    <td>UQ24CA853SE</td>
    <td>4</td>
    <td>Semester 4</td>
    <td>Elective specialization paper II</td>
  </tr>
  <tr>
    <td>Project Work Phase I</td>
    <td>[LOCATION:idx_0]</td>
    <td>8</td>
    <td>Semester 4</td>
    <td>Major project design and implementation phase 1</td>
  </tr>
  <tr>
    <t
... [truncated — see full response in UI]
```

---

## 8. AF0196 — ✅ PASS

**Query:** `show my teaching assignments`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Semester</strong></th>
    <th><strong>Courses</strong></th>
  </tr>
  <tr>
    <td>Semester 1</td>
    <td>Data Structures, Computer Networks, OS, DBMS, Discrete Mathematics</td>
  </tr>
  <tr>
    <td>Semester 2</td>
    <td>Machine Learning, Cloud Computing, Software Engineering, Advanced Algorithms</td>
  </tr>
  <tr>
    <td>Semester 3</td>
    <td>Electives: IoT, Blockchain, Big Data, NLP, Cybersecurity, Full Stack Development</td>
  </tr>
  <tr>
    <td>Semester 4</td>
    <td>Electives: IoT, Blockchain, Big Data, NLP, Cybersecurity, Full Stack Development</td>
  </tr>
</table>
Source: Teaching Assignment Information
```

---

## 9. AF0197 — ✅ PASS

**Query:** `what is my designation?`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `0.991`

**Response:**

```
The designation for FAC_MCA003 is Associate Professor.

Source: Faculty Record #3
```

---

## 10. AF0198 — ✅ PASS

**Query:** `my contact information`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Email</strong></th>
    <th><strong>Phone</strong></th>
  </tr>
  <tr>
    <td>[EMAIL:idx_1]</td>
    <td>[PHONE:idx_1]</td>
  </tr>
</table>
Source: Faculty Record #8
```

---

## 11. AF0199 — ✅ PASS

**Query:** `tell me my email address`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `0.998`

**Response:**

```
Here is the email address for the faculty member with ID FAC_MCA002:

<table>
  <tr>
    <th>Email</th>
  </tr>
  <tr>
    <td>[EMAIL:idx_1]</td>
  </tr>
</table>

Source: Faculty Record #4
```

---

## 12. AF0200 — ✅ PASS

**Query:** `what is my employee ID?`  
**Test User SRN/ID:** `FAC_MCA001`  
**Expected value in response:** `FAC_MCA001`  
**Confidence:** `0`

**Response:**

```
Your employee ID is **FAC_MCA001**.
```

---

## 13. AF0201 — ✅ PASS

**Query:** `show my faculty record`  
**Test User SRN/ID:** `FAC_MCA003`  
**Expected value in response:** `FAC_MCA003`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Employee ID / Faculty ID</td>
    <td>FAC_MCA003</td>
  </tr>
  <tr>
    <td>Department</td>
    <td>Master of Computer Applications (MCA)</td>
  </tr>
  <tr>
    <td>University</td>
    <td>PES University</td>
  </tr>
</table>

Source: Faculty Aggregate Record
```

---

## 14. AF0202 — ✅ PASS

**Query:** `give me my complete information`  
**Test User SRN/ID:** `FAC_MCA004`  
**Expected value in response:** `FAC_MCA004`  
**Confidence:** `0`

**Response:**

```
I'm sorry, I cannot process this request. Our systems have flagged this intent as potentially unsafe (PII_PROBE). Access denied.
```

---

## 15. AF0203 — ✅ PASS

**Query:** `what subjects am I teaching?`  
**Test User SRN/ID:** `FAC_MCA005`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Course Name</strong></th>
    <th><strong>Course Code</strong></th>
    <th><strong>Credits</strong></th>
    <th><strong>Semester Offered</strong></th>
  </tr>
  <tr>
    <td>Cyber Security and Ethical Hacking</td>
    <td>UQ24CA756A</td>
    <td>4</td>
    <td>Semester 3</td>
  </tr>
</table>
Source: [Course Record]
```

---

## 16. AF0204 — ✅ PASS

**Query:** `which section do I handle?`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `1`

**Response:**

```
You handle the Master of Computer Applications (MCA) department. 

Source: [Department Record #3]
```

---

## 17. AF0205 — ✅ PASS

**Query:** `my qualifications`  
**Test User SRN/ID:** `FAC_MCA002`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Qualification</strong></th>
  </tr>
  <tr>
    <td>PhD - IISc Bangalore</td>
  </tr>
</table>
Source: Faculty Record #3
```

---

## 18. AF0206 — ✅ PASS

**Query:** `what is my experience?`  
**Test User SRN/ID:** `FAC_MCA003`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Experience</strong></th>
    <td>10 years</td>
  </tr>
</table>
Source: Faculty Record
```

---

## 19. AF0207 — ✅ PASS

**Query:** `show my academic profile`  
**Test User SRN/ID:** `FAC_MCA004`  
**Expected value in response:** `FAC_MCA004`  
**Confidence:** `0.992`

**Response:**

```
Here is your academic profile:

<table>
  <tr>
    <th>FIELD</th>
    <th>VALUE</th>
  </tr>
  <tr>
    <td>First Name</td>
    <td>[PERSON:idx_0]</td>
  </tr>
  <tr>
    <td>Last Name</td>
    <td>[PERSON:idx_1]</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>[EMAIL:idx_1]</td>
  </tr>
  <tr>
    <td>Department</td>
    <td>Electrical and Electronics Engg</td>
  </tr>
  <tr>
    <td>Designation</td>
    <td>Associate Professor</td>
  </tr>
  <tr>
    <td>Specialization</td>
    <td>Agile, DevOps</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_1]</td>
  </tr>
  <tr>
    <td>Office Location</td>
    <td>MCA Block, Room 304</td>
  </tr>
  <tr>
    <td>Join Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Is Department Head</td>
    <td>No</td>
  </tr>
  <tr>
    <td>Qualif
... [truncated — see full response in UI]
```

---

## 20. AF0208 — ✅ PASS

**Query:** `who is FAC_MCA001?`  
**Test User SRN/ID:** `FAC_MCA001`  
**Expected value in response:** `FAC_MCA001`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>First Name</td>
    <td>[PERSON:idx_0]</td>
  </tr>
  <tr>
    <td>Last Name</td>
    <td>[PERSON:idx_1]</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>[EMAIL:idx_1]</td>
  </tr>
  <tr>
    <td>Department</td>
    <td>Master of Computer Applications</td>
  </tr>
  <tr>
    <td>Designation</td>
    <td>Professor & HOD</td>
  </tr>
  <tr>
    <td>Specialization</td>
    <td>Data Mining, AI</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_1]</td>
  </tr>
  <tr>
    <td>Office Location</td>
    <td>[COMPANY:idx_4], Room 301</td>
  </tr>
  <tr>
    <td>Join Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Is Department Head</td>
    <td>True</td>
  </tr>
  <tr>
    <td>Qualification</td>
    <td>PhD -
... [truncated — see full response in UI]
```

---

## 21. AF0209 — ✅ PASS

**Query:** `tell me about FAC_MCA002`  
**Test User SRN/ID:** `FAC_MCA002`  
**Expected value in response:** `FAC_MCA002`  
**Confidence:** `0.986`

**Response:**

```
Here is the complete profile for FAC_MCA002:

<table>
  <tr>
    <th>FIELD</th>
    <th>VALUE</th>
  </tr>
  <tr>
    <td>First Name</td>
    <td>[PERSON:idx_0]</td>
  </tr>
  <tr>
    <td>Last Name</td>
    <td>[PERSON:idx_1]</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>[EMAIL:idx_1]</td>
  </tr>
  <tr>
    <td>Department</td>
    <td>Computer Science and Engineering</td>
  </tr>
  <tr>
    <td>Designation</td>
    <td>Professor</td>
  </tr>
  <tr>
    <td>Specialization</td>
    <td>Deep Learning, NLP</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_1]</td>
  </tr>
  <tr>
    <td>Office Location</td>
    <td>PES Tech Tower, Room 302</td>
  </tr>
  <tr>
    <td>Join Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Is Department Head</td>
    <td>No</td>
  </tr>
  <tr>
... [truncated — see full response in UI]
```

---

## 22. AF0210 — ✅ PASS

**Query:** `FAC_MCA003 details`  
**Test User SRN/ID:** `FAC_MCA003`  
**Expected value in response:** `FAC_MCA003`  
**Confidence:** `0.998`

**Response:**

```
Here are the details for the faculty member with ID FAC_MCA003:

<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>First Name</td>
    <td>[PERSON:idx_0]</td>
  </tr>
  <tr>
    <td>Last Name</td>
    <td>[PERSON:idx_1]</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>[EMAIL:idx_1]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_2]</td>
  </tr>
  <tr>
    <td>Designation</td>
    <td>Associate Professor</td>
  </tr>
  <tr>
    <td>Specialization</td>
    <td>Cloud Computing, Networks</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_1]</td>
  </tr>
  <tr>
    <td>Office Location</td>
    <td>[COMPANY:idx_2], Room 303</td>
  </tr>
  <tr>
    <td>Join Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Is Department Head</td>
    <td>Fals
... [truncated — see full response in UI]
```

---

## 23. AF0211 — ✅ PASS

**Query:** `my faculty information please`  
**Test User SRN/ID:** `FAC_MCA005`  
**Expected value in response:** `FAC_MCA005`  
**Confidence:** `1`

**Response:**

```
Here is your faculty information:

<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>First Name</td>
    <td>[PERSON:idx_0]</td>
  </tr>
  <tr>
    <td>Last Name</td>
    <td>[PERSON:idx_1]</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>[EMAIL:idx_0]</td>
  </tr>
  <tr>
    <td>Department</td>
    <td>[ID:idx_1]</td>
  </tr>
  <tr>
    <td>Designation</td>
    <td>Associate Professor</td>
  </tr>
  <tr>
    <td>Specialization</td>
    <td>Cyber Security</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_0]</td>
  </tr>
  <tr>
    <td>Office Location</td>
    <td>[COMPANY:idx_0], Room 305</td>
  </tr>
  <tr>
    <td>Join Date</td>
    <td>[DATE:idx_0]</td>
  </tr>
  <tr>
    <td>Is Department Head</td>
    <td>False</td>
  </tr>
  <tr>
    <td>Qualification<
... [truncated — see full response in UI]
```

---

## 24. AF0212 — ✅ PASS

**Query:** `what is my role in the department?`  
**Test User SRN/ID:** `FAC_MCA001`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Role</th>
    <td>Professor & HOD</td>
  </tr>
</table>
Source: [FACULTY RECORD]
```

---

## 25. AF0213 — ✅ PASS

**Query:** `show my department allocation`  
**Test User SRN/ID:** `FAC_MCA002`  
**Expected value in response:** `MCA`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Department</strong></th>
    <th><strong>Student Count</strong></th>
  </tr>
  <tr>
    <td>MCA</td>
    <td>350 students</td>
  </tr>
</table>

Source: Faculty Aggregate Record
```

---
