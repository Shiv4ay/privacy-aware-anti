# Category H — Admin Individual Lookup

**Role:** `admin`  
**Login:** `admin@pes.edu`  
**Purpose:** Admin looks up a specific student record by SRN. Must return data, not 'not found'.  
**Queries tested:** 30

---

## 1. AF0130 — ✅ PASS

**Query:** `show student profile for PES1PG24CA002`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA002`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>FIELD</th>
    <th>VALUE</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
  </tr>
  <tr>
    <td>First Name</td>
    <td>[PERSON:idx_2]</td>
  </tr>
  <tr>
    <td>Last Name</td>
    <td>[PERSON:idx_3]</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>[EMAIL:idx_1]</td>
  </tr>
  <tr>
    <td>Gender</td>
    <td>M</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_3]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_4]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_0]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>GPA</td>
    <td>5.74</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_1]</td>
  </t
... [truncated — see full response in UI]
```

---

## 2. AF0131 — ✅ PASS

**Query:** `PES1PG24CA003 full profile`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA003`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>FIELD</th>
    <th>VALUE</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
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
    <td>Gender</td>
    <td>M</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_0]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_0]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>GPA</td>
    <td>8.32</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_0]</td>
  </t
... [truncated — see full response in UI]
```

---

## 3. AF0129 — ✅ PASS

**Query:** `give me details of PES1PG24CA001`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA001`  
**Confidence:** `1`

**Response:**

```
Here are the details for the student [USER_ID:idx_0]:

<table>
  <tr>
    <th>FIELD</th>
    <th>VALUE</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
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
    <td>Gender</td>
    <td>F</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_0]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_0]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>GPA</td>
    <td>8.1</td>
  </tr>
  <t
... [truncated — see full response in UI]
```

---

## 4. AF0132 — ✅ PASS

**Query:** `what are the marks of PES1PG24CA004?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA004`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Course</th>
    <th>Semester</th>
    <th>Grade</th>
    <th>Score</th>
    <th>Credits</th>
    <th>Remarks</th>
  </tr>
  <tr>
    <td>Data Structures</td>
    <td>1</td>
    <td>A</td>
    <td>74</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Programming with Python</td>
    <td>1</td>
    <td>B</td>
    <td>58</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Object Oriented Software Engineering</td>
    <td>1</td>
    <td>C</td>
    <td>43</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Personality Development</td>
    <td>1</td>
    <td>C</td>
    <td>46</td>
    <td>3</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Aptitude and Reasoning</td>
    <td>2</td>
    <td>B+</td>
    <td>65</td>
    <td>3</td>
    <td>Pass</td>
  <
... [truncated — see full response in UI]
```

---

## 5. AF0133 — ✅ PASS

**Query:** `PES1PG24CA005 academic record`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA005`  
**Confidence:** `1`

**Response:**

```
Here is the academic record for [USER_ID:idx_0]:

<table>
  <tr>
    <th>Course</th>
    <th>Semester</th>
    <th>Grade</th>
    <th>Score</th>
    <th>Credits</th>
    <th>Remarks</th>
  </tr>
  <tr>
    <td>Programming with Python</td>
    <td>1</td>
    <td>B</td>
    <td>59</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Data Structures</td>
    <td>1</td>
    <td>B+</td>
    <td>63</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Databases and Applications</td>
    <td>1</td>
    <td>B+</td>
    <td>63</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Operating Systems Design</td>
    <td>1</td>
    <td>B</td>
    <td>52</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Object Oriented Software Engineering</td>
    <td>1</td>
    <td>B</
... [truncated — see full response in UI]
```

---

## 6. AF0134 — ✅ PASS

**Query:** `show placement details for PES1PG24CA006`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA006`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
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
    <td>Gender</td>
    <td>F</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_0]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_0]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>GPA</td>
    <td>5.71</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_0]</td>
  </t
... [truncated — see full response in UI]
```

---

## 7. AF0135 — ✅ PASS

**Query:** `PES1PG24CA007 CGPA and marks`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA007`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Course</strong></th>
    <th><strong>Semester</strong></th>
    <th><strong>Grade</strong></th>
    <th><strong>Score</strong></th>
    <th><strong>Credits</strong></th>
    <th><strong>Remarks</strong></th>
  </tr>
  <tr>
    <td>Databases and Applications</td>
    <td>1</td>
    <td>B+</td>
    <td>60</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Programming with Python</td>
    <td>1</td>
    <td>A</td>
    <td>73</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Operating Systems Design</td>
    <td>1</td>
    <td>A</td>
    <td>70</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Personality Development</td>
    <td>1</td>
    <td>A</td>
    <td>70</td>
    <td>3</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Aptitude
... [truncated — see full response in UI]
```

---

## 8. AF0136 — ✅ PASS

**Query:** `where is PES1PG24CA008 placed?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA008`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
  </tr>
  <tr>
    <td>First Name</td>
    <td>[PERSON:idx_12]</td>
  </tr>
  <tr>
    <td>Last Name</td>
    <td>[PERSON:idx_13]</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>[EMAIL:idx_6]</td>
  </tr>
  <tr>
    <td>Gender</td>
    <td>F</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_12]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_13]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_0]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>Gpa</td>
    <td>9.93</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_6]</td>
... [truncated — see full response in UI]
```

---

## 9. AF0137 — ✅ PASS

**Query:** `internship details for PES1PG24CA009`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA009`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
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
    <td>Gender</td>
    <td>F</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_0]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_0]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>GPA</td>
    <td>7.39</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_0]</td>
  </t
... [truncated — see full response in UI]
```

---

## 10. AF0138 — ✅ PASS

**Query:** `show complete record of PES1PG24CA010`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA010`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
  </tr>
  <tr>
    <td>First Name</td>
    <td>[PERSON:idx_22]</td>
  </tr>
  <tr>
    <td>Last Name</td>
    <td>[PERSON:idx_23]</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>[EMAIL:idx_10]</td>
  </tr>
  <tr>
    <td>Gender</td>
    <td>F</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_39]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_40]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_1]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>1</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>Gpa</td>
    <td>7.88</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_10]</td>
... [truncated — see full response in UI]
```

---

## 11. AF0139 — ✅ PASS

**Query:** `PES1PG24CA011 email and contact`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA011`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Email</strong></th>
    <th><strong>Phone</strong></th>
  </tr>
  <tr>
    <td>[EMAIL:idx_0]</td>
    <td>[PHONE:idx_0]</td>
  </tr>
</table>
Source: Master Profile #1
```

---

## 12. AF0140 — ✅ PASS

**Query:** `give me PES1PG24CA012 personal info`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA012`  
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
    <td>[EMAIL:idx_0]</td>
  </tr>
  <tr>
    <td>Gender</td>
    <td>M</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_0]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_0]</td>
  </tr>
  <tr>
    <td>Address</td>
    <td>43, Vijayanagar, Bangalore - [REDACTED:idx_1], [REDACTED:idx_0]</td>
  </tr>
</table>
Source: Master Profile #1
```

---

## 13. AF0141 — ✅ PASS

**Query:** `PES1PG24CA013 semester-wise marks`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA013`  
**Confidence:** `1`

**Response:**

```
Here are the semester-wise marks for [USER_ID:idx_0]:

<table>
  <tr>
    <th><strong>Semester</strong></th>
    <th><strong>Course</strong></th>
    <th><strong>Grade</strong></th>
    <th><strong>Score</strong></th>
    <th><strong>Credits</strong></th>
    <th><strong>Remarks</strong></th>
  </tr>
  <tr>
    <td>1</td>
    <td>Operating Systems Design</td>
    <td>A</td>
    <td>73</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>1</td>
    <td>Programming with Python</td>
    <td>C</td>
    <td>45</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>1</td>
    <td>Personality Development</td>
    <td>C</td>
    <td>47</td>
    <td>3</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>1</td>
    <td>Data Structures</td>
    <td>B+</td>
    <td>65</td>
    <td>4</td>
    <t
... [truncated — see full response in UI]
```

---

## 14. AF0142 — ✅ PASS

**Query:** `PES1PG24CA169 full student data`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA169`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
  </tr>
  <tr>
    <td>First Name</td>
    <td>[PERSON:idx_0]</td>
  </tr>
  <tr>
    <td>Middle Name</td>
    <td>[PERSON:idx_1]</td>
  </tr>
  <tr>
    <td>Last Name</td>
    <td>[PERSON:idx_2]</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>[EMAIL:idx_0]</td>
  </tr>
  <tr>
    <td>Gender</td>
    <td>M</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_0]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_0]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>GPA</td>
    <td>8.12</td
... [truncated — see full response in UI]
```

---

## 15. AF0143 — ✅ PASS

**Query:** `show details for student PES1PG24CA160`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA160`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>FIELD</th>
    <th>VALUE</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
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
    <td>Gender</td>
    <td>M</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_0]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_0]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>GPA</td>
    <td>5.51</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_0]</td>
  </t
... [truncated — see full response in UI]
```

---

## 16. AF0144 — ✅ PASS

**Query:** `PES1PG24CA143 placement status`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA143`  
**Confidence:** `0`

**Response:**

```
No placement/internship record found in the database for this student.
```

---

## 17. AF0145 — ✅ PASS

**Query:** `look up PES1PG24CA003 in the system`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA003`  
**Confidence:** `1`

**Response:**

```
Here is the complete profile for the student associated with [USER_ID:idx_0]:

<table>
  <tr>
    <th>FIELD</th>
    <th>VALUE</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
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
    <td>Gender</td>
    <td>M</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_0]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Department</td>
    <td>Master of Computer Applications</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
... [truncated — see full response in UI]
```

---

## 18. AF0146 — ✅ PASS

**Query:** `fetch PES1PG24CA001 data`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA001`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Course</th>
    <th>Semester</th>
    <th>Grade</th>
    <th>Score</th>
    <th>Credits</th>
    <th>Remarks</th>
  </tr>
  <tr>
    <td>Data Structures</td>
    <td>1</td>
    <td>A+</td>
    <td>83</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Databases and Applications</td>
    <td>1</td>
    <td>A</td>
    <td>78</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Programming with Python</td>
    <td>1</td>
    <td>B+</td>
    <td>68</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Operating Systems Design</td>
    <td>1</td>
    <td>A</td>
    <td>76</td>
    <td>4</td>
    <td>Pass</td>
  </tr>
  <tr>
    <td>Personality Development</td>
    <td>1</td>
    <td>A+</td>
    <td>84</td>
    <td>3</td>
    <td>Pass</td>
  </tr>
... [truncated — see full response in UI]
```

---

## 19. AF0147 — ✅ PASS

**Query:** `tell me about student PES1PG24CA007`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA007`  
**Confidence:** `1`

**Response:**

```
Here is the complete profile for the student [USER_ID:idx_0]:

<table>
  <tr>
    <th>FIELD</th>
    <th>VALUE</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
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
    <td>Gender</td>
    <td>F</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_0]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_1]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_0]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>GPA</td>
    <td>7.17</td>
  <
... [truncated — see full response in UI]
```

---

## 20. AF0148 — ✅ PASS

**Query:** `PES1PG24CA005 where is she placed?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PES1PG24CA005`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Student Id</td>
    <td>[USER_ID:idx_0]</td>
  </tr>
  <tr>
    <td>First Name</td>
    <td>[PERSON:idx_6]</td>
  </tr>
  <tr>
    <td>Last Name</td>
    <td>[PERSON:idx_10]</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>[EMAIL:idx_5]</td>
  </tr>
  <tr>
    <td>Gender</td>
    <td>M</td>
  </tr>
  <tr>
    <td>Date Of Birth</td>
    <td>[DATE:idx_11]</td>
  </tr>
  <tr>
    <td>Enrollment Date</td>
    <td>[DATE:idx_12]</td>
  </tr>
  <tr>
    <td>Department Id</td>
    <td>[ID:idx_0]</td>
  </tr>
  <tr>
    <td>Current Semester</td>
    <td>1</td>
  </tr>
  <tr>
    <td>Status</td>
    <td>Active</td>
  </tr>
  <tr>
    <td>Gpa</td>
    <td>6.35</td>
  </tr>
  <tr>
    <td>Phone</td>
    <td>[PHONE:idx_5]</td>
... [truncated — see full response in UI]
```

---

## 21. AF0149 — ✅ PASS

**Query:** `who are the top 5 students by CGPA?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `1`

**Response:**

```
Here are the top 5 students by CGPA grade performance:

<table>
  <tr>
    <th>First Name</th>
    <th>Last Name</th>
    <th>GPA</th>
    <th>Current Semester</th>
  </tr>
  <tr>
    <td>[PERSON:idx_4]</td>
    <td>[PERSON:idx_5]</td>
    <td>7.46</td>
    <td>2</td>
  </tr>
  <tr>
    <td>[PERSON:idx_6]</td>
    <td>[PERSON:idx_7]</td>
    <td>7.28</td>
    <td>4</td>
  </tr>
  <tr>
    <td>[PERSON:idx_2]</td>
    <td>[PERSON:idx_3]</td>
    <td>6.11</td>
    <td>3</td>
  </tr>
  <tr>
    <td>[PERSON:idx_8]</td>
    <td>[PERSON:idx_9]</td>
    <td>6.48</td>
    <td>3</td>
  </tr>
  <tr>
    <td>[PERSON:idx_0]</td>
    <td>[PERSON:idx_1]</td>
    <td>6.07</td>
    <td>1</td>
  </tr>
</table>

Source: Student Records.
```

---

## 22. AF0150 — ✅ PASS

**Query:** `show students with CGPA above 9.0`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `9`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>First Name</th>
    <th>Last Name</th>
    <th>GPA</th>
    <th>Current Semester</th>
  </tr>
  <tr>
    <td>[PERSON:idx_2]</td>
    <td>[PERSON:idx_3]</td>
    <td>9.07</td>
    <td>4</td>
  </tr>
  <tr>
    <td>[PERSON:idx_20]</td>
    <td>[PERSON:idx_21]</td>
    <td>9.48</td>
    <td>4</td>
  </tr>
</table>
Source: Student Records
```

---

## 23. AF0151 — ❌ FAIL

**Query:** `which students are not placed yet?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `1`

**Response:**

```
I could not find information about this in the available records. Please try rephrasing your query or provide a specific ID.
```

---

## 24. AF0152 — ✅ PASS

**Query:** `list students who did internships at Google India`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Google India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Student Registration Number</strong></th>
  </tr>
  <tr>
    <td>PES1PG24CA014</td>
  </tr>
  <tr>
    <td>PES1PG24CA036</td>
  </tr>
  <tr>
    <td>PES1PG24CA055</td>
  </tr>
  <tr>
    <td>PES1PG24CA160</td>
  </tr>
  <tr>
    <td>PES1PG24CA168</td>
  </tr>
  <tr>
    <td>PES1PG24CA216</td>
  </tr>
  <tr>
    <td>PES1PG24CA248</td>
  </tr>
  <tr>
    <td>PES1PG24CA298</td>
  </tr>
  <tr>
    <td>PES1PG24CA306</td>
  </tr>
  <tr>
    <td>PES1PG24CA343</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 25. AF0153 — ✅ PASS

**Query:** `which students are placed at Oracle India?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
Here is the list of students placed at Oracle India:

<table>
  <tr>
    <th><strong>Student ID</strong></th>
    <th><strong>Position</strong></th>
  </tr>
  <tr>
    <td>PES1PG24CA013</td>
    <td>Applications Engineer</td>
  </tr>
  <tr>
    <td>PES1PG24CA078</td>
    <td>Applications Engineer</td>
  </tr>
  <tr>
    <td>PES1PG24CA156</td>
    <td>Applications Engineer</td>
  </tr>
  <tr>
    <td>PES1PG24CA218</td>
    <td>Applications Engineer</td>
  </tr>
  <tr>
    <td>PES1PG24CA278</td>
    <td>Applications Engineer</td>
  </tr>
</table>

Total students placed: 5. 

Source: Oracle India Placement List.
```

---

## 26. AF0154 — ✅ PASS

**Query:** `show me students placed at PayTM`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PayTM`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Position</strong></th>
    <th><strong>Student ID</strong></th>
  </tr>
  <tr>
    <td>Placement</td>
    <td>SDE-I</td>
    <td>PES1PG24CA144</td>
  </tr>
  <tr>
    <td>Placement</td>
    <td>SDE-I</td>
    <td>PES1PG24CA203</td>
  </tr>
  <tr>
    <td>Placement</td>
    <td>SDE-I</td>
    <td>PES1PG24CA235</td>
  </tr>
  <tr>
    <td>Placement</td>
    <td>SDE-I</td>
    <td>PES1PG24CA340</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 27. AF0155 — ✅ PASS

**Query:** `students placed in Bangalore with salary above 10 LPA`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Bangalore`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Location</strong></th>
    <th><strong>Students Placed</strong></th>
    <th><strong>Salary ≥ 10 LPA</strong></th>
  </tr>
  <tr>
    <td>Bangalore</td>
    <td>26</td>
    <td>33</td>
  </tr>
</table>

Note: The number of students placed in Bangalore is 26, while the total number of students placed with a salary above 10 LPA is 33. 

Source: ADMIN STATISTICS RECORD.
```

---

## 28. AF0156 — ✅ PASS

**Query:** `list all students and their placement companies`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
No placement/internship record found in the database for this student.
```

---

## 29. AF0157 — ✅ PASS

**Query:** `show students who completed internships at Cognizant`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Cognizant`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Student Registration Number</strong></th>
  </tr>
  <tr>
    <td>PES1PG24CA043</td>
  </tr>
  <tr>
    <td>PES1PG24CA046</td>
  </tr>
  <tr>
    <td>PES1PG24CA062</td>
  </tr>
  <tr>
    <td>PES1PG24CA086</td>
  </tr>
  <tr>
    <td>PES1PG24CA111</td>
  </tr>
  <tr>
    <td>PES1PG24CA155</td>
  </tr>
  <tr>
    <td>PES1PG24CA277</td>
  </tr>
  <tr>
    <td>PES1PG24CA299</td>
  </tr>
  <tr>
    <td>PES1PG24CA320</td>
  </tr>
</table>
<p>Total: 9 student(s)</p>
Source: ADMIN STATISTICS RECORD
```

---

## 30. AF0158 — ✅ PASS

**Query:** `which students interned at PayTM?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PayTM`  
**Confidence:** `0`

**Response:**

```
Here is the list of students who interned at PayTM:

<table>
  <tr>
    <th><strong>Student Registration Number</strong></th>
  </tr>
  <tr>
    <td>PES1PG24CA027</td>
  </tr>
  <tr>
    <td>PES1PG24CA031</td>
  </tr>
  <tr>
    <td>PES1PG24CA116</td>
  </tr>
  <tr>
    <td>PES1PG24CA139</td>
  </tr>
  <tr>
    <td>PES1PG24CA140</td>
  </tr>
  <tr>
    <td>PES1PG24CA165</td>
  </tr>
  <tr>
    <td>PES1PG24CA174</td>
  </tr>
  <tr>
    <td>PES1PG24CA187</td>
  </tr>
  <tr>
    <td>PES1PG24CA225</td>
  </tr>
  <tr>
    <td>PES1PG24CA242</td>
  </tr>
  <tr>
    <td>PES1PG24CA339</td>
  </tr>
</table>

Total students who interned at PayTM: 11.

Source: Internship Statistics Record.
```

---
