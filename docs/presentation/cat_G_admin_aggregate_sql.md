# Category G — Admin Aggregate SQL

**Role:** `admin`  
**Login:** `admin@pes.edu`  
**Purpose:** Queries that return aggregate statistics (counts, averages, rankings) from the database.  
**Queries tested:** 128

---

## 1. AF0001 — ✅ PASS

**Query:** `how many students are placed?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
The number of students placed is 54. 

Source: ADMIN STATISTICS RECORD.
```

---

## 2. AF0005 — ✅ PASS

**Query:** `how many students got placed this year?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Placed</strong></th>
    <th><strong>Total Students</strong></th>
    <th><strong>Placement Rate</strong></th>
  </tr>
  <tr>
    <td>54</td>
    <td>349</td>
    <td>15.5%</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 3. AF0011 — ✅ PASS

**Query:** `how many internships are there?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
There are a total of 175 internship records in the system. 

Source: ADMIN STATISTICS RECORD
```

---

## 4. AF0012 — ✅ PASS

**Query:** `total internship count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
The total internship count is 175. 

Source: ADMIN STATISTICS RECORD.
```

---

## 5. AF0013 — ✅ PASS

**Query:** `how many students did internships?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
The total number of students who did internships is 175. 

Source: ADMIN STATISTICS RECORD.
```

---

## 6. AF0016 — ✅ PASS

**Query:** `total number of internships recorded`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
The total number of internships recorded is 175.

Source: ADMIN STATISTICS RECORD
```

---

## 7. AF0017 — ✅ PASS

**Query:** `give me internship count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Internship Count</strong></th>
  </tr>
  <tr>
    <td>175</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 8. AF0018 — ✅ PASS

**Query:** `how many internship records exist?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
There are a total of 175 internship records in the system. 

Source: ADMIN STATISTICS RECORD.
```

---

## 9. AF0031 — ✅ PASS

**Query:** `what is the highest salary offered?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `22`  
**Confidence:** `0`

**Response:**

```
The highest salary offered is â‚¹2,200,000 (â‚¹22.0 Lakhs). 

Source: ADMIN STATISTICS RECORD.
```

---

## 10. AF0032 — ✅ PASS

**Query:** `maximum CTC in placement drive`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `22`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Maximum CTC</strong></th>
  </tr>
  <tr>
    <td>Highest CTC</td>
    <td>â‚¹2,200,000 (â‚¹22.0 Lakhs)</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 11. AF0035 — ✅ PASS

**Query:** `maximum salary in placements`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `22`  
**Confidence:** `0`

**Response:**

```
The maximum salary in placements is â‚¹2,200,000 (â‚¹22.0 Lakhs). 

Source: ADMIN STATISTICS RECORD.
```

---

## 12. AF0036 — ✅ PASS

**Query:** `what is the average salary of placed students?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `11`  
**Confidence:** `0`

**Response:**

```
The average salary of placed students is â‚¹1,179,630. 

Source: ADMIN STATISTICS RECORD.
```

---

## 13. AF0037 — ✅ PASS

**Query:** `average CTC across all placements`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `11`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Average CTC</strong></th>
  </tr>
  <tr>
    <td>All Placements</td>
    <td>â‚¹1,179,630</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 14. AF0039 — ✅ PASS

**Query:** `average package in this batch`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `11`  
**Confidence:** `0`

**Response:**

```
The average package in this batch is â‚¹1,179,630. 

Source: ADMIN STATISTICS RECORD.
```

---

## 15. AF0074 — ✅ PASS

**Query:** `placement rate statistics`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Statistic</strong></th>
    <th><strong>Value</strong></th>
  </tr>
  <tr>
    <td>Placed</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Total Students</td>
    <td>349</td>
  </tr>
  <tr>
    <td>Placement Rate</td>
    <td>15.5%</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 16. AF0075 — ✅ PASS

**Query:** `what percent of students are placed?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
The percentage of students placed is calculated by dividing the total number of students placed by the total number of students enrolled and then multiplying by 100.

Given:
- Total students placed: 54
- Total students enrolled: 349

Placement percentage = (Total students placed / Total students enrolled) * 100  
Placement percentage = (54 / 349) * 100 â‰ˆ 15.5%

Therefore, approximately **15.5%** of students are placed. 

Source: ADMIN STATISTICS RECORD
```

---

## 17. AF0076 — ✅ PASS

**Query:** `total students vs placed students`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Total Students</strong></th>
    <th><strong>Placed Students</strong></th>
  </tr>
  <tr>
    <td>349</td>
    <td>54</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 18. AF0003 — ✅ PASS

**Query:** `give me the placement count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
The placement count is 54. 

Source: ADMIN STATISTICS RECORD
```

---

## 19. AF0004 — ✅ PASS

**Query:** `what is the total placement count for this batch?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
The total placement count for this batch is 54. 

Source: ADMIN STATISTICS RECORD
```

---

## 20. AF0006 — ✅ PASS

**Query:** `placement statistics overview`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Value</strong></th>
  </tr>
  <tr>
    <td>Placed</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Total Students</td>
    <td>349</td>
  </tr>
  <tr>
    <td>Placement Rate</td>
    <td>15.5%</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 21. AF0014 — ✅ PASS

**Query:** `internship statistics`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Statistic</strong></th>
    <th><strong>Value</strong></th>
  </tr>
  <tr>
    <td>Total students who did internships</td>
    <td>175</td>
  </tr>
  <tr>
    <td>Total internship records in system</td>
    <td>175</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 22. AF0015 — ✅ PASS

**Query:** `show me internship numbers`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Total Students Who Did Internships</strong></th>
    <th><strong>Total Internship Records in System</strong></th>
  </tr>
  <tr>
    <td>175</td>
    <td>175</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 23. AF0042 — ✅ PASS

**Query:** `placement count in Bangalore`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `26`  
**Confidence:** `0`

**Response:**

```
The placement count in Bangalore is 26. 

Source: ADMIN STATISTICS RECORD.
```

---

## 24. AF0045 — ✅ PASS

**Query:** `Bangalore based placement count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `26`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Count</strong></th>
  </tr>
  <tr>
    <td>Bangalore Based Placements</td>
    <td>26</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 25. AF0046 — ✅ PASS

**Query:** `how many placements in Hyderabad?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `7`  
**Confidence:** `0`

**Response:**

```
There are 7 placements in Hyderabad. 

Source: ADMIN STATISTICS RECORD.
```

---

## 26. AF0047 — ✅ PASS

**Query:** `Hyderabad placement count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `7`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Location</strong></th>
    <th><strong>Placement Count</strong></th>
  </tr>
  <tr>
    <td>Hyderabad</td>
    <td>7</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 27. AF0048 — ✅ PASS

**Query:** `how many students placed in Chennai?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `4`  
**Confidence:** `0`

**Response:**

```
The number of students placed in Chennai is 4. 

Source: ADMIN STATISTICS RECORD.
```

---

## 28. AF0063 — ✅ PASS

**Query:** `how many internships are in Bangalore?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `104`  
**Confidence:** `0`

**Response:**

```
There are 104 internships in Bangalore. 

Source: ADMIN STATISTICS RECORD.
```

---

## 29. AF0065 — ✅ PASS

**Query:** `internship distribution by location`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Bangalore`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Location</strong></th>
    <th><strong>Count</strong></th>
  </tr>
  <tr>
    <td>Bangalore</td>
    <td>8</td>
  </tr>
  <tr>
    <td>Pune</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Noida</td>
    <td>1</td>
  </tr>
  <tr>
    <td>Gurugram</td>
    <td>1</td>
  </tr>
</table>

Source: Internship Records
```

---

## 30. AF0068 — ✅ PASS

**Query:** `show placement and internship summary`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Total</strong></th>
  </tr>
  <tr>
    <td>Internships</td>
    <td>175</td>
  </tr>
  <tr>
    <td>Placements</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Combined Total (Placements + Internships)</td>
    <td>229</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 31. AF0070 — ✅ PASS

**Query:** `placement dashboard statistics`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Statistic</strong></th>
    <th><strong>Value</strong></th>
  </tr>
  <tr>
    <td>Placed</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Total Students</td>
    <td>349</td>
  </tr>
  <tr>
    <td>Placement Rate</td>
    <td>15.5%</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 32. AF0071 — ✅ PASS

**Query:** `how is the placement performance this year?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
The placement performance as of the provided date is as follows:

<table>
  <tr>
    <th><strong>Metric</strong></th>
    <th><strong>Value</strong></th>
  </tr>
  <tr>
    <td>Placed</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Total Students</td>
    <td>349</td>
  </tr>
  <tr>
    <td>Placement Rate</td>
    <td>15.5%</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 33. AF0077 — ✅ PASS

**Query:** `compare placement and internship numbers`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Count</strong></th>
  </tr>
  <tr>
    <td>Internships Completed</td>
    <td>175</td>
  </tr>
  <tr>
    <td>Students Placed</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Total Students</td>
    <td>349</td>
  </tr>
  <tr>
    <td>Placement Rate</td>
    <td>15.5%</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 34. AF0091 — ✅ PASS

**Query:** `internships in Pune count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `19`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Statistic</strong></th>
    <th><strong>Value</strong></th>
  </tr>
  <tr>
    <td>Highest CTC</td>
    <td>Rs.2,200,000 (22.0 LPA)</td>
  </tr>
  <tr>
    <td>Lowest CTC</td>
    <td>Rs.650,000 (6.5 LPA)</td>
  </tr>
  <tr>
    <td>Average CTC</td>
    <td>Rs.1,179,630 (11.8 LPA)</td>
  </tr>
  <tr>
    <td>Median CTC</td>
    <td>Rs.1,200,000 (12.0 LPA)</td>
  </tr>
  <tr>
    <td>Salary Range</td>
    <td>Rs.650,000 â€” Rs.2,200,000 (6.5 LPA to 22.0 LPA)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 35. AF0117 — ✅ PASS

**Query:** `Noida placement count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `8`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Location</strong></th>
    <th><strong>Placement Count</strong></th>
  </tr>
  <tr>
    <td>Noida</td>
    <td>8</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 36. AF0120 — ✅ PASS

**Query:** `how many students are in the placement database?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
There are 54 students in the placement database. 

Source: ADMIN STATISTICS RECORD.
```

---

## 37. AF0121 — ✅ PASS

**Query:** `what is the CTC range for placed students?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `22`  
**Confidence:** `0`

**Response:**

```
The CTC range for placed students is as follows:

<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>CTC Amount</strong></th>
  </tr>
  <tr>
    <td>Highest CTC</td>
    <td>â‚¹2,200,000 (â‚¹22.0 Lakhs)</td>
  </tr>
  <tr>
    <td>Lowest CTC</td>
    <td>â‚¹650,000 (â‚¹6.5 Lakhs)</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 38. AF0021 — ✅ PASS

**Query:** `which company hired the most students?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Students Hired</th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 39. AF0022 — ✅ PASS

**Query:** `top hiring company`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Students Hired</th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 40. AF0023 — ✅ PASS

**Query:** `which company has the highest placements?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
The company with the highest placements is Oracle India, with 5 students hired. 

Source: ADMIN STATISTICS RECORD
```

---

## 41. AF0024 — ✅ PASS

**Query:** `which company recruited the most MCA students?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
The company that recruited the most students is Oracle India, with 5 students hired.

Source: ADMIN STATISTICS RECORD
```

---

## 42. AF0025 — ✅ PASS

**Query:** `top recruiter in placement drives`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Students Hired</th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 43. AF0026 — ✅ PASS

**Query:** `which company absorbed the most students?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
The company that absorbed the most students is Oracle India, with 5 students hired.

Source: ADMIN STATISTICS RECORD
```

---

## 44. AF0027 — ✅ PASS

**Query:** `most popular company for placements`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
The most popular company for placements is Oracle India, with 5 students hired.

Source: ADMIN STATISTICS RECORD
```

---

## 45. AF0028 — ✅ PASS

**Query:** `which organization placed maximum students?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
The organization that placed the maximum students is Oracle India, with 5 students hired.

Source: ADMIN STATISTICS RECORD
```

---

## 46. AF0030 — ✅ PASS

**Query:** `top company by number of students placed`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Students Hired</th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 47. AF0034 — ✅ PASS

**Query:** `what is the best salary any student got?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `22`  
**Confidence:** `0`

**Response:**

```
The highest CTC received by any student is â‚¹2,200,000 (â‚¹22.0 Lakhs). 

Source: ADMIN STATISTICS RECORD.
```

---

## 48. AF0057 — ✅ PASS

**Query:** `top 10 recruiting companies`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Company</strong></th>
    <th><strong>Students Hired</strong></th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5</td>
  </tr>
  <tr>
    <td>Zomato</td>
    <td>4</td>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>4</td>
  </tr>
  <tr>
    <td>HCL Technologies</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Publicis Sapient</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Swiggy</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Freshworks</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Mphasis</td>
    <td>3</td>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>3</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 49. AF0069 — ✅ PASS

**Query:** `give me the overall placement report`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Value</strong></th>
  </tr>
  <tr>
    <td>Placed</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Total Students</td>
    <td>349</td>
  </tr>
  <tr>
    <td>Placement Rate</td>
    <td>15.5%</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 50. AF0108 — ✅ PASS

**Query:** `overall internship analytics dashboard`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Metric</strong></th>
    <th><strong>Value</strong></th>
  </tr>
  <tr>
    <td>Total students who did internships</td>
    <td>175</td>
  </tr>
  <tr>
    <td>Total internship records in system</td>
    <td>175</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 51. AF0007 — ✅ PASS

**Query:** `show placement summary`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Value</strong></th>
  </tr>
  <tr>
    <td>Placed</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Total Students</td>
    <td>349</td>
  </tr>
  <tr>
    <td>Placement Rate</td>
    <td>15.5%</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 52. AF0008 — ✅ PASS

**Query:** `number of placements in the MCA department`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
The number of placements in the MCA department is 54. 

Source: ADMIN STATISTICS RECORD.
```

---

## 53. AF0002 — ✅ PASS

**Query:** `total number of student placements`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
The total number of student placements is 54. 

Source: ADMIN STATISTICS RECORD.
```

---

## 54. AF0009 — ✅ PASS

**Query:** `total placements in organization`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Total Placements in Organization</strong></th>
  </tr>
  <tr>
    <td>54</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 55. AF0019 — ✅ PASS

**Query:** `count of internships in our system`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
The total count of internships in our system is 175. 

Source: ADMIN STATISTICS RECORD.
```

---

## 56. AF0010 — ✅ PASS

**Query:** `how many MCA students have been placed?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
The total number of MCA students placed is 54. 

Source: ADMIN STATISTICS RECORD.
```

---

## 57. AF0020 — ✅ PASS

**Query:** `internship enrollment count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `175`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Internship Enrollment Count</strong></th>
  </tr>
  <tr>
    <td>175</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 58. AF0029 — ✅ PASS

**Query:** `company with maximum hires`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Hires</th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5 student(s) hired</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 59. AF0033 — ✅ PASS

**Query:** `highest package offered to MCA students`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `22`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Highest Package Offered</strong></th>
  </tr>
  <tr>
    <td>CTC</td>
    <td>Rs.2,200,000 (22.0 LPA)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 60. AF0038 — ✅ PASS

**Query:** `mean salary of placed MCA students`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `11`  
**Confidence:** `0`

**Response:**

```
The mean salary of placed MCA students is Rs.1,179,630 (11.8 LPA). 

Source: ADMIN STATISTICS RECORD.
```

---

## 61. AF0040 — ✅ PASS

**Query:** `what is the median compensation for placed students?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `11`  
**Confidence:** `0`

**Response:**

```
The median compensation for placed students is Rs.1,200,000 (12.0 LPA). 

Source: ADMIN STATISTICS RECORD.
```

---

## 62. AF0041 — ✅ PASS

**Query:** `how many students placed in Bangalore?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `26`  
**Confidence:** `0`

**Response:**

```
The number of students placed in Bangalore is 26. 

Source: ADMIN STATISTICS RECORD.
```

---

## 63. AF0043 — ✅ PASS

**Query:** `number of Bangalore placements`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `26`  
**Confidence:** `1`

**Response:**

```
The number of placements in Bangalore is 26. 

Source: ADMIN STATISTICS RECORD.
```

---

## 64. AF0044 — ✅ PASS

**Query:** `how many students are working in Bangalore?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `26`  
**Confidence:** `0`

**Response:**

```
There are 26 students working in Bangalore. 

Source: ADMIN STATISTICS RECORD.
```

---

## 65. AF0049 — ✅ PASS

**Query:** `show top 5 placement cities`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Bangalore`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>City</strong></th>
    <th><strong>Placement Count</strong></th>
  </tr>
  <tr>
    <td>Bangalore</td>
    <td>26</td>
  </tr>
  <tr>
    <td>Noida</td>
    <td>8</td>
  </tr>
  <tr>
    <td>Hyderabad</td>
    <td>7</td>
  </tr>
  <tr>
    <td>Gurugram</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Chennai</td>
    <td>4</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 66. AF0050 — ✅ PASS

**Query:** `placement distribution by location`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Bangalore`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Location</strong></th>
    <th><strong>Number of Placements</strong></th>
  </tr>
  <tr>
    <td>Bangalore</td>
    <td>26</td>
  </tr>
  <tr>
    <td>Noida</td>
    <td>8</td>
  </tr>
  <tr>
    <td>Hyderabad</td>
    <td>7</td>
  </tr>
  <tr>
    <td>Gurugram</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Chennai</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Mumbai</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Pune</td>
    <td>2</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 67. AF0051 — ✅ PASS

**Query:** `list all companies that hired students`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `1`

**Response:**

```
The company that hired the most students is Oracle India, with 5 students placed. 

Source: ADMIN STATISTICS RECORD
```

---

## 68. AF0052 — ✅ PASS

**Query:** `show all placement companies`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Company Name</th>
    <th>Placement Count</th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5 student(s)</td>
  </tr>
  <tr>
    <td>Zomato</td>
    <td>4 student(s)</td>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>4 student(s)</td>
  </tr>
  <tr>
    <td>HCL Technologies</td>
    <td>4 student(s)</td>
  </tr>
  <tr>
    <td>Publicis Sapient</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Freshworks</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Mphasis</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Swiggy</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>VMware India</td>
    <td>2 student(s)</td>
  </tr>
  <tr
... [truncated — see full response in UI]
```

---

## 69. AF0053 — ✅ PASS

**Query:** `which companies participated in placement?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
Here are the companies that participated in placement along with the number of students placed:

<table>
  <tr>
    <th>Company</th>
    <th>Number of Students Placed</th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5</td>
  </tr>
  <tr>
    <td>Zomato</td>
    <td>4</td>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>4</td>
  </tr>
  <tr>
    <td>HCL Technologies</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Publicis Sapient</td>
    <td>3</td>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Freshworks</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Mphasis</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Swiggy</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>3</td>
  </tr>
  <tr>
    <td>VMware India</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Microsoft
... [truncated — see full response in UI]
```

---

## 70. AF0054 — ✅ PASS

**Query:** `list hiring companies with student count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Company</strong></th>
    <th><strong>Student Count</strong></th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5</td>
  </tr>
  <tr>
    <td>Zomato</td>
    <td>4</td>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>4</td>
  </tr>
  <tr>
    <td>HCL Technologies</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Publicis Sapient</td>
    <td>3</td>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Freshworks</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Mphasis</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Swiggy</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>3</td>
  </tr>
  <tr>
    <td>VMware India</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Microsoft India</td>
    <td>2</td>
  </tr>
  <tr>
    <td>TCS</td>
    <td>2</td>
... [truncated — see full response in UI]
```

---

## 71. AF0055 — ✅ PASS

**Query:** `give me a list of all recruiting companies`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Recruiting Companies</strong></th>
  </tr>
  <tr>
    <td>Oracle India</td>
  </tr>
  <tr>
    <td>Zomato</td>
  </tr>
  <tr>
    <td>PayTM</td>
  </tr>
  <tr>
    <td>HCL Technologies</td>
  </tr>
  <tr>
    <td>Publicis Sapient</td>
  </tr>
  <tr>
    <td>KPMG India</td>
  </tr>
  <tr>
    <td>Freshworks</td>
  </tr>
  <tr>
    <td>Mphasis</td>
  </tr>
  <tr>
    <td>Swiggy</td>
  </tr>
  <tr>
    <td>Amazon India</td>
  </tr>
  <tr>
    <td>VMware India</td>
  </tr>
  <tr>
    <td>Microsoft India</td>
  </tr>
  <tr>
    <td>TCS</td>
  </tr>
  <tr>
    <td>Mindtree</td>
  </tr>
  <tr>
    <td>Persistent Systems</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 72. AF0056 — ✅ PASS

**Query:** `show companies and number of students placed`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Company</strong></th>
    <th><strong>Number of Students Placed</strong></th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5</td>
  </tr>
  <tr>
    <td>Zomato</td>
    <td>4</td>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>4</td>
  </tr>
  <tr>
    <td>HCL Technologies</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Publicis Sapient</td>
    <td>3</td>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Freshworks</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Mphasis</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Swiggy</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>3</td>
  </tr>
  <tr>
    <td>VMware India</td>
    <td>2</td>
  </tr>
  <tr>
    <td>Microsoft India</td>
    <td>2</td>
  </tr>
  <tr>
    <td>TCS</td>
... [truncated — see full response in UI]
```

---

## 73. AF0058 — ✅ PASS

**Query:** `average internship stipend`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `16`  
**Confidence:** `1`

**Response:**

```
The average internship stipend is â‚¹16,749/month. 

Source: ADMIN STATISTICS RECORD.
```

---

## 74. AF0059 — ✅ PASS

**Query:** `what is the average monthly stipend for internships?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `16`  
**Confidence:** `0`

**Response:**

```
The average monthly stipend for internships is â‚¹16,749. 

Source: ADMIN STATISTICS RECORD.
```

---

## 75. AF0060 — ✅ PASS

**Query:** `highest internship stipend offered`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `25`  
**Confidence:** `1`

**Response:**

```
The highest internship stipend offered is â‚¹25,000/month. 

Source: ADMIN STATISTICS RECORD.
```

---

## 76. AF0061 — ✅ PASS

**Query:** `which company offered most internships?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PayTM`  
**Confidence:** `0`

**Response:**

```
The company that offered the most internships is PayTM, with 11 students participating. 

Source: ADMIN STATISTICS RECORD
```

---

## 77. AF0062 — ✅ PASS

**Query:** `top internship company`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PayTM`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Internship Count</th>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>11 student(s)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 78. AF0064 — ✅ PASS

**Query:** `Bangalore internship count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `104`  
**Confidence:** `0`

**Response:**

```
The count of internships in Bangalore is 104.

Source: ADMIN STATISTICS RECORD
```

---

## 79. AF0066 — ✅ PASS

**Query:** `list internship companies`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PayTM`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Company</strong></th>
    <th><strong>Internship Count</strong></th>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>11 student(s)</td>
  </tr>
  <tr>
    <td>Google India</td>
    <td>10 student(s)</td>
  </tr>
  <tr>
    <td>Persistent Systems</td>
    <td>10 student(s)</td>
  </tr>
  <tr>
    <td>Cognizant</td>
    <td>9 student(s)</td>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>9 student(s)</td>
  </tr>
  <tr>
    <td>IBM India</td>
    <td>8 student(s)</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>8 student(s)</td>
  </tr>
  <tr>
    <td>Flipkart</td>
    <td>8 student(s)</td>
  </tr>
  <tr>
    <td>Publicis Sapient</td>
    <td>8 student(s)</td>
  </tr>
  <tr>
    <td>Capgemini</td>
    <td>8 student(s)</td>
  </tr>
  <tr>
    <td>Mphasis</td>
... [truncated — see full response in UI]
```

---

## 80. AF0067 — ✅ PASS

**Query:** `show internship statistics by company`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PayTM`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Company</strong></th>
    <th><strong>Interns</strong></th>
    <th><strong>Average Stipend</strong></th>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>11 intern(s)</td>
    <td>Rs.16,364/month</td>
  </tr>
  <tr>
    <td>Google India</td>
    <td>10 intern(s)</td>
    <td>Rs.17,300/month</td>
  </tr>
  <tr>
    <td>Persistent Systems</td>
    <td>10 intern(s)</td>
    <td>Rs.18,700/month</td>
  </tr>
  <tr>
    <td>Cognizant</td>
    <td>9 intern(s)</td>
    <td>Rs.15,889/month</td>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>9 intern(s)</td>
    <td>Rs.18,111/month</td>
  </tr>
  <tr>
    <td>Flipkart</td>
    <td>8 intern(s)</td>
    <td>Rs.14,625/month</td>
  </tr>
  <tr>
    <td>IBM India</td>
    <td>8 intern(s)</td>
    <td>Rs.19,500/month</td>
  </tr>
... [truncated — see full response in UI]
```

---

## 81. AF0072 — ✅ PASS

**Query:** `show me all placement KPIs`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>Metric</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Placed</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Total Students</td>
    <td>349</td>
  </tr>
  <tr>
    <td>Placement Rate</td>
    <td>15.5%</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 82. AF0073 — ✅ PASS

**Query:** `comprehensive placement analytics`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Metric</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Total placements</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Average CTC</td>
    <td>â‚¹1,179,630</td>
  </tr>
  <tr>
    <td>Highest CTC</td>
    <td>â‚¹2,200,000</td>
  </tr>
  <tr>
    <td>Top 5 companies</td>
    <td>
      <ul>
        <li>Oracle India: 5</li>
        <li>PayTM: 4</li>
        <li>Zomato: 4</li>
        <li>HCL Technologies: 4</li>
        <li>Publicis Sapient: 3</li>
      </ul>
    </td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 83. AF0078 — ✅ PASS

**Query:** `which batch has the most placements?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `2025`  
**Confidence:** `0`

**Response:**

```
The batch with the most placements is Batch 2025, with a total of 54 placements. 

Source: ADMIN STATISTICS RECORD
```

---

## 84. AF0079 — ✅ PASS

**Query:** `show salary distribution for placed students`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `11`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Amount</strong></th>
  </tr>
  <tr>
    <td>Highest CTC / Maximum salary / highest package</td>
    <td>Rs.2,200,000 (22.0 LPA)</td>
  </tr>
  <tr>
    <td>Lowest CTC / Minimum salary / lowest package</td>
    <td>Rs.650,000 (6.5 LPA)</td>
  </tr>
  <tr>
    <td>Average CTC / Mean salary</td>
    <td>Rs.1,179,630 (11.8 LPA)</td>
  </tr>
  <tr>
    <td>Median CTC / Median compensation</td>
    <td>Rs.1,200,000 (12.0 LPA)</td>
  </tr>
  <tr>
    <td>Salary range</td>
    <td>Rs.650,000 â€” Rs.2,200,000 (6.5 LPA to 22.0 LPA)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 85. AF0080 — ✅ PASS

**Query:** `how many students got salary above 10 LPA?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `0`

**Response:**

```
The number of students who received a salary above 10 LPA (â‚¹1,000,000) is 33 students.

Source: ADMIN STATISTICS RECORD
```

---

## 86. AF0081 — ✅ PASS

**Query:** `list students placed at Google India`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Google India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>Category</th>
    <th>Position</th>
    <th>Organization</th>
    <th>Duration/Status</th>
    <th>Stipend/Salary</th>
  </tr>
  <tr>
    <td>Placement</td>
    <td>Software Engineer</td>
    <td>Google India</td>
    <td>N/A</td>
    <td>N/A</td>
  </tr>
</table>
Source: Google India PLACEMENT LIST
```

---

## 87. AF0082 — ✅ PASS

**Query:** `how many students are placed at PayTM?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `4`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Position</strong></th>
    <th><strong>Organization</strong></th>
    <th><strong>Duration/Status</strong></th>
    <th><strong>Stipend/Salary</strong></th>
  </tr>
  <tr>
    <td>Placement</td>
    <td>N/A</td>
    <td>PayTM</td>
    <td>N/A</td>
    <td>N/A</td>
  </tr>
</table>

<p>Number of students placed at PayTM: 4</p>
Source: ADMIN STATISTICS RECORD
```

---

## 88. AF0083 — ✅ PASS

**Query:** `placement count for Zomato`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `4`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Placement Count</strong></th>
  </tr>
  <tr>
    <td>Zomato</td>
    <td>4</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 89. AF0084 — ✅ PASS

**Query:** `how many students joined Amazon India?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `3`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Number of Students</strong></th>
  </tr>
  <tr>
    <td>Placements at Amazon India</td>
    <td>3 student(s)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 90. AF0085 — ✅ PASS

**Query:** `Swiggy placement count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `3`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Placement Count</strong></th>
  </tr>
  <tr>
    <td>Swiggy</td>
    <td>3</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 91. AF0086 — ✅ PASS

**Query:** `how many students are placed at HCL Technologies?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `4`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Position</strong></th>
    <th><strong>Organization</strong></th>
    <th><strong>Duration/Status</strong></th>
    <th><strong>Stipend/Salary</strong></th>
  </tr>
  <tr>
    <td>Placement</td>
    <td>N/A</td>
    <td>HCL Technologies</td>
    <td>N/A</td>
    <td>N/A</td>
  </tr>
</table>
<p>4 student(s) are placed at HCL Technologies.</p>
Source: ADMIN STATISTICS RECORD
```

---

## 92. AF0087 — ✅ PASS

**Query:** `list all placements with company and salary`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PayTM`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Position</th>
    <th>Salary</th>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>SDE-I</td>
    <td>[FINANCE:idx_0]</td>
  </tr>
  <tr>
    <td>[PERSON:idx_0]</td>
    <td>[COMPANY:idx_0]</td>
    <td>[FINANCE:idx_1]</td>
  </tr>
  <tr>
    <td>[COMPANY:idx_1] India</td>
    <td>Associate [COMPANY:idx_2]</td>
    <td>[FINANCE:idx_2]</td>
  </tr>
  <tr>
    <td>[PERSON:idx_1]</td>
    <td>Associate [REDACTED:idx_0]</td>
    <td>[FINANCE:idx_3]</td>
  </tr>
  <tr>
    <td>[COMPANY:idx_3] India</td>
    <td>[COMPANY:idx_4]</td>
    <td>[FINANCE:idx_4]</td>
  </tr>
  <tr>
    <td>[COMPANY:idx_5]</td>
    <td>Associate [COMPANY:idx_6]</td>
    <td>[FINANCE:idx_5]</td>
  </tr>
  <tr>
    <td>[COMPANY:idx_7]</td>
    <td>Associate [COMPANY:idx_8]</td>
    <t
... [truncated — see full response in UI]
```

---

## 93. AF0088 — ✅ PASS

**Query:** `show placement locations ranking`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Bangalore`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Location</strong></th>
    <th><strong>Number of Placements</strong></th>
  </tr>
  <tr>
    <td>Bangalore</td>
    <td>26</td>
  </tr>
  <tr>
    <td>Noida</td>
    <td>8</td>
  </tr>
  <tr>
    <td>Hyderabad</td>
    <td>7</td>
  </tr>
  <tr>
    <td>Gurugram</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Chennai</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Mumbai</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Pune</td>
    <td>2</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 94. AF0089 — ✅ PASS

**Query:** `top 3 placement companies by count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Placement Count</th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5 student(s)</td>
  </tr>
  <tr>
    <td>Zomato</td>
    <td>4 student(s)</td>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>4 student(s)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 95. AF0090 — ✅ PASS

**Query:** `which role was offered most in placements?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `1`

**Response:**

```
The role offered most in placements is "Software Engineer," with 15 students placed in this position. 

Source: ADMIN STATISTICS RECORD.
```

---

## 96. AF0092 — ✅ PASS

**Query:** `internship count for Cognizant`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `9`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Count</strong></th>
  </tr>
  <tr>
    <td>Cognizant Internships</td>
    <td>9</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 97. AF0093 — ✅ PASS

**Query:** `how many KPMG internships are there?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `9`  
**Confidence:** `1`

**Response:**

```
There are 9 internships at KPMG India. 

Source: ADMIN STATISTICS RECORD.
```

---

## 98. AF0094 — ✅ PASS

**Query:** `average stipend for Google India internships`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `0`

**Response:**

```
The average stipend for internships at Google India is â‚¹17,300/month. 

Source: ADMIN STATISTICS RECORD.
```

---

## 99. AF0095 — ✅ PASS

**Query:** `total placements and internships combined`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `0`

**Response:**

```
The combined total of placements and internships is 229.

Source: ADMIN STATISTICS RECORD.
```

---

## 100. AF0096 — ✅ PASS

**Query:** `show top 5 internship companies`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `PayTM`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Company</strong></th>
    <th><strong>Internship Count</strong></th>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>11 student(s)</td>
  </tr>
  <tr>
    <td>Google India</td>
    <td>10 student(s)</td>
  </tr>
  <tr>
    <td>Persistent Systems</td>
    <td>10 student(s)</td>
  </tr>
  <tr>
    <td>Cognizant</td>
    <td>9 student(s)</td>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>9 student(s)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 101. AF0097 — ✅ PASS

**Query:** `internship count in Noida`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `16`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Count</strong></th>
  </tr>
  <tr>
    <td>Internship Count in Noida</td>
    <td>16</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 102. AF0099 — ✅ PASS

**Query:** `company-wise placement breakdown`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Company</strong></th>
    <th><strong>Placement Count</strong></th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5 student(s)</td>
  </tr>
  <tr>
    <td>Zomato</td>
    <td>4 student(s)</td>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>4 student(s)</td>
  </tr>
  <tr>
    <td>HCL Technologies</td>
    <td>4 student(s)</td>
  </tr>
  <tr>
    <td>Publicis Sapient</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Freshworks</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Mphasis</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Swiggy</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>VMware India</td>
    <td>2
... [truncated — see full response in UI]
```

---

## 103. AF0100 — ✅ PASS

**Query:** `highest salary company for placed students`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Google India`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Salary Offered</th>
  </tr>
  <tr>
    <td>Google India</td>
    <td>Rs.2,200,000 (22.0 LPA)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 104. AF0101 — ✅ PASS

**Query:** `which company offers the best stipend for internships?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `0`

**Response:**

```
The company that offers the best stipend for internships is **Tech Mahindra** and **HCL Technologies**, both providing an average stipend of **Rs. 22,000/month**.

Source: ADMIN STATISTICS RECORD
```

---

## 105. AF0102 — ✅ PASS

**Query:** `compare Bangalore vs Hyderabad placements`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `26`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Location</strong></th>
    <th><strong>Placement Count</strong></th>
  </tr>
  <tr>
    <td>Bangalore</td>
    <td>26</td>
  </tr>
  <tr>
    <td>Hyderabad</td>
    <td>7</td>
  </tr>
</table>

Source: ADMIN STATISTICS RECORD
```

---

## 106. AF0103 — ✅ PASS

**Query:** `how many students got internships in Chennai?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `15`  
**Confidence:** `0`

**Response:**

```
The total number of students who got internships in Chennai is 15.

Source: ADMIN STATISTICS RECORD
```

---

## 107. AF0104 — ✅ PASS

**Query:** `Persistent Systems internship count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `10`  
**Confidence:** `0`

**Response:**

```
The internship count at Persistent Systems is 10 intern(s).

Source: ADMIN STATISTICS RECORD
```

---

## 108. AF0105 — ✅ PASS

**Query:** `Google India internship count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `10`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Count</strong></th>
  </tr>
  <tr>
    <td>Google India Internship Count</td>
    <td>10</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 109. AF0106 — ✅ PASS

**Query:** `list all companies with at least 3 placements`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Oracle India`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Placement Count</th>
  </tr>
  <tr>
    <td>Oracle India</td>
    <td>5 student(s)</td>
  </tr>
  <tr>
    <td>Zomato</td>
    <td>4 student(s)</td>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>4 student(s)</td>
  </tr>
  <tr>
    <td>HCL Technologies</td>
    <td>4 student(s)</td>
  </tr>
  <tr>
    <td>Publicis Sapient</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Freshworks</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Mphasis</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Swiggy</td>
    <td>3 student(s)</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>3 student(s)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 110. AF0107 — ✅ PASS

**Query:** `show me placement data for this organization`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Category</th>
    <th>Position</th>
    <th>Organization</th>
    <th>Duration/Status</th>
    <th>Stipend/Salary</th>
  </tr>
  <tr>
    <td>Placement</td>
    <td>N/A</td>
    <td>N/A</td>
    <td>54 placements</td>
    <td>N/A</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 111. AF0109 — ✅ PASS

**Query:** `top 5 cities for placements`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Bangalore`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>City</strong></th>
    <th><strong>Number of Placements</strong></th>
  </tr>
  <tr>
    <td>Bangalore</td>
    <td>26</td>
  </tr>
  <tr>
    <td>Noida</td>
    <td>8</td>
  </tr>
  <tr>
    <td>Hyderabad</td>
    <td>7</td>
  </tr>
  <tr>
    <td>Gurugram</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Chennai</td>
    <td>4</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 112. AF0110 — ✅ PASS

**Query:** `which city has most internships?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Bangalore`  
**Confidence:** `1`

**Response:**

```
The city with the most internships is Bangalore, with a total of 104 internships. 

Source: ADMIN STATISTICS RECORD.
```

---

## 113. AF0111 — ✅ PASS

**Query:** `show me the placement performance report`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `54`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Value</strong></th>
  </tr>
  <tr>
    <td>Placed</td>
    <td>54</td>
  </tr>
  <tr>
    <td>Total Students</td>
    <td>349</td>
  </tr>
  <tr>
    <td>Placement Rate</td>
    <td>15.5%</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 114. AF0112 — ✅ PASS

**Query:** `what is the minimum salary in placements?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Minimum Salary</strong></th>
  </tr>
  <tr>
    <td>Rs.650,000 (6.5 LPA)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 115. AF0114 — ✅ PASS

**Query:** `Freshworks placement count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `3`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Placement Count</strong></th>
  </tr>
  <tr>
    <td>Freshworks</td>
    <td>3</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 116. AF0115 — ✅ PASS

**Query:** `KPMG India placement count`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `3`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Placement Count</strong></th>
  </tr>
  <tr>
    <td>KPMG India</td>
    <td>3 student(s)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 117. AF0118 — ✅ PASS

**Query:** `show all placement records sorted by salary`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `22`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Company</th>
    <th>Role</th>
    <th>Salary</th>
    <th>Location</th>
  </tr>
  <tr>
    <td>Google India</td>
    <td>Software Engineer</td>
    <td>Rs.2,200,000 (22.0 LPA)</td>
    <td>Bangalore</td>
  </tr>
  <tr>
    <td>Microsoft India</td>
    <td>Software Development Engineer</td>
    <td>Rs.2,000,000 (20.0 LPA)</td>
    <td>Hyderabad</td>
  </tr>
  <tr>
    <td>Microsoft India</td>
    <td>Software Development Engineer</td>
    <td>Rs.2,000,000 (20.0 LPA)</td>
    <td>Hyderabad</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>SDE-I</td>
    <td>Rs.1,800,000 (18.0 LPA)</td>
    <td>Bangalore</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>SDE-I</td>
    <td>Rs.1,800,000 (18.0 LPA)</td>
    <td>Bangalore</td>
  </tr>
  <tr>
    <td>Amazon India</t
... [truncated — see full response in UI]
```

---

## 118. AF0119 — ✅ PASS

**Query:** `internship count in Mumbai`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `8`  
**Confidence:** `0`

**Response:**

```
The internship count in Mumbai is 8.

Source: ADMIN STATISTICS RECORD
```

---

## 119. AF0122 — ✅ PASS

**Query:** `stipend range for internships`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `25`  
**Confidence:** `0`

**Response:**

```
The stipend range for internships is as follows:

- **Minimum Stipend:** â‚¹8,000/month
- **Maximum Stipend:** â‚¹25,000/month

Source: ADMIN STATISTICS RECORD.
```

---

## 120. AF0123 — ✅ PASS

**Query:** `show me companies that hired for SDE roles`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Company</strong></th>
    <th><strong>Number of Students Hired</strong></th>
  </tr>
  <tr>
    <td>PayTM</td>
    <td>4</td>
  </tr>
  <tr>
    <td>Amazon India</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Swiggy</td>
    <td>3</td>
  </tr>
  <tr>
    <td>Flipkart</td>
    <td>1</td>
  </tr>
  <tr>
    <td>Razorpay</td>
    <td>1</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 121. AF0124 — ✅ PASS

**Query:** `internships that pay above 20000 per month`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th>Category</th>
    <th>Position</th>
    <th>Organization</th>
    <th>Duration/Status</th>
    <th>Stipend/Salary</th>
  </tr>
  <tr>
    <td>Internship</td>
    <td>N/A</td>
    <td>N/A</td>
    <td>N/A</td>
    <td>â‚¹25,000/month</td>
  </tr>
  <tr>
    <td>Internship</td>
    <td>N/A</td>
    <td>N/A</td>
    <td>N/A</td>
    <td>â‚¹20,000/month</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 122. AF0125 — ✅ PASS

**Query:** `placements with salary above 15 LPA`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Confidence:** `1`

**Response:**

```
<table>
  <tr>
    <th><strong>Category</strong></th>
    <th><strong>Position</strong></th>
    <th><strong>Organization</strong></th>
    <th><strong>Duration/Status</strong></th>
    <th><strong>Stipend/Salary</strong></th>
  </tr>
  <tr>
    <td>Placement</td>
    <td>N/A</td>
    <td>N/A</td>
    <td>N/A</td>
    <td>â‰¥ â‚¹1,500,000 (15 LPA)</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 123. AF0126 — ✅ PASS

**Query:** `list all Bangalore based companies in placements`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `Bangalore`  
**Confidence:** `1`

**Response:**

```
Here is a list of Bangalore-based companies from the placement records:

<table>
  <tr>
    <th>Company</th>
  </tr>
  <tr>
    <td>[COMPANY:idx_0] India</td>
  </tr>
  <tr>
    <td>[COMPANY:idx_1]</td>
  </tr>
  <tr>
    <td>Razorpay</td>
  </tr>
  <tr>
    <td>Flipkart</td>
  </tr>
  <tr>
    <td>[COMPANY:idx_2] India</td>
  </tr>
  <tr>
    <td>[COMPANY:idx_3]</td>
  </tr>
  <tr>
    <td>[COMPANY:idx_4] India</td>
  </tr>
  <tr>
    <td>[COMPANY:idx_5] Technologies</td>
  </tr>
  <tr>
    <td>VMware India</td>
  </tr>
  <tr>
    <td>PayTM</td>
  </tr>
</table>

Source: Placement Records
```

---

## 124. AF0127 — ✅ PASS

**Query:** `how many different companies hired students?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `26`  
**Confidence:** `1`

**Response:**

```
The total number of different companies that hired students is 26. 

Source: ADMIN STATISTICS RECORD.
```

---

## 125. AF0128 — ✅ PASS

**Query:** `distinct companies in placement records`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `26`  
**Confidence:** `1`

**Response:**

```
The number of distinct companies with placements is 26.

Source: ADMIN STATISTICS RECORD
```

---

## 126. AF0098 — ✅ PASS

**Query:** `what is the placement rate for MCA batch 2024?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `15`  
**Confidence:** `0`

**Response:**

```
The placement rate for MCA batch 2024 is 15.5%. 

Source: ADMIN STATISTICS RECORD.
```

---

## 127. AF0113 — ✅ PASS

**Query:** `how many students placed at Mphasis?`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `3`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Company</strong></th>
    <th><strong>Students Placed</strong></th>
  </tr>
  <tr>
    <td>Mphasis</td>
    <td>3</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---

## 128. AF0116 — ✅ PASS

**Query:** `placements in Gurugram`  
**Test User SRN/ID:** `ADMIN_ORG4`  
**Expected value in response:** `4`  
**Confidence:** `0`

**Response:**

```
<table>
  <tr>
    <th><strong>Location</strong></th>
    <th><strong>Students Placed</strong></th>
    <th><strong>Placement Count</strong></th>
  </tr>
  <tr>
    <td>Gurugram</td>
    <td>4</td>
    <td>4</td>
  </tr>
</table>
Source: ADMIN STATISTICS RECORD
```

---
