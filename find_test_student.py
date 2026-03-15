import pandas as pd
import os

base_path = "c:/project3/AntiGravity/Datasets/University/pes_mca_dataset"

df_students = pd.read_csv(os.path.join(base_path, "students.csv"), on_bad_lines='skip')
df_results = pd.read_csv(os.path.join(base_path, "results.csv"), on_bad_lines='skip')
df_placement = pd.read_csv(os.path.join(base_path, "placements.csv"), on_bad_lines='skip')
df_internship = pd.read_csv(os.path.join(base_path, "internships.csv"), on_bad_lines='skip')

# Strip whitespace from column names just in case
df_students.columns = df_students.columns.str.strip()
df_results.columns = df_results.columns.str.strip()
df_placement.columns = df_placement.columns.str.strip()
df_internship.columns = df_internship.columns.str.strip()

import pandas as pd
import os

base_path = "c:/project3/AntiGravity/Datasets/University/pes_mca_dataset"
target_id = "PES1PG24CA135"

s_df = pd.read_csv(os.path.join(base_path, "students.csv"), on_bad_lines='skip')
p_df = pd.read_csv(os.path.join(base_path, "placements.csv"), on_bad_lines='skip')
i_df = pd.read_csv(os.path.join(base_path, "internships.csv"), on_bad_lines='skip')

print("Student:", s_df[s_df.iloc[:, 19].astype(str).str.strip() == target_id].iloc[:, :4].values)
print("Placement:", p_df[p_df.iloc[:, 1].astype(str).str.strip() == target_id].values)
print("Internship:", i_df[i_df.iloc[:, 1].astype(str).str.strip() == target_id].values)

