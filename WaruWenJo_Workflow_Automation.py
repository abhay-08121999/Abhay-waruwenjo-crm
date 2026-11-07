from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

# --- CONFIGURATION ---
BASE_URL = "http://localhost:3001"
LOGIN_URL = f"{BASE_URL}/#/login"
EMAIL = "karthik19rathod@gmail.com"
PASSWORD = "Karthik@19"

driver = webdriver.Chrome()
driver.maximize_window()
wait = WebDriverWait(driver, 15)

def safe_click(element_xpath):
    try: 
        # Wait for any potential overlay to disappear
        wait.until(EC.invisibility_of_element_located((By.XPATH, "//div[contains(@class, 'bg-slate-900/40')]")))
    except: pass
    element = wait.until(EC.presence_of_element_located((By.XPATH, element_xpath)))
    time.sleep(0.5)
    try: 
        wait.until(EC.element_to_be_clickable((By.XPATH, element_xpath))).click()
    except Exception: 
        driver.execute_script("arguments[0].click();", element)

print("====================================")
print("WARUWENJO CRM WORKFLOW AUTOMATION")
print("====================================")

# INITIAL LOGIN
try:
    driver.get(LOGIN_URL)
    wait.until(EC.presence_of_element_located((By.XPATH, "//input[@id='adminEmail']"))).send_keys(EMAIL)
    driver.find_element(By.XPATH, "//input[@id='adminPassword']").send_keys(PASSWORD)
    safe_click("//button[@type='submit']")
    time.sleep(3)
    print("Login sequence complete.")
except Exception as e:
    print(f"Login Failed: {e}")

# NAVIGATE TO MODULE
try:
    driver.get(f"{BASE_URL}/#/patient-leads")
    time.sleep(2)
except: pass

print(f"{'Test':<8} | {'Expected Result':<30} | {'Actual Result':<15} | {'Status'}")
print("-" * 80)

# TC_P1: Full Lead Intake (Stage 1)
try:
    safe_click("//button[contains(., 'New Intake')]")
    time.sleep(1)
    
    patient_name = f"Auto Patient {int(time.time() % 10000)}"
    wait.until(EC.presence_of_element_located((By.XPATH, "//label[contains(text(), 'Full Name')]/..//input"))).send_keys(patient_name)
    driver.find_element(By.XPATH, "//label[contains(text(), 'Clinical Interest')]/..//input").send_keys("Cardiology Checkup")
    driver.find_element(By.XPATH, "//label[contains(text(), 'Nationality')]/..//input").send_keys("Oman")
    driver.find_element(By.XPATH, "//label[contains(text(), 'Email')]/..//input").send_keys("auto.test@waruwenjo.com")
    
    safe_click("//button[contains(text(), 'Onboard Inquiry')]")
    time.sleep(2)
    
    if patient_name in driver.page_source:
        print(f"{'TC_P1':<8} | {'Lead created in Board':<30} | {'Found Card':<15} | {'Success'}")
    else:
        print(f"{'TC_P1':<8} | {'Lead created in Board':<30} | {'Card Missing':<15} | {'Fail'}")
except: print(f"{'TC_P1':<8} | {'Lead created in Board':<30} | {'Script Error':<15} | {'Fail'}")

# TC_P2: Open Lead & Start Outreach (Stage 2)
try:
    safe_click(f"//h4[contains(text(), '{patient_name}')]")
    time.sleep(1.5)
    
    # Complete checklist
    tasks = driver.find_elements(By.XPATH, "//div[contains(@class, 'flex items-center gap-3 p-4 rounded-2xl border-2')]")
    for task in tasks: task.click(); time.sleep(0.3)
    
    safe_click("//button[contains(., 'Move to Outreach')]")
    time.sleep(1.5)
    
    if "Stage 2" in driver.page_source:
        print(f"{'TC_P2':<8} | {'Enter Outreach Stage':<30} | {'Stage 2 Active':<15} | {'Success'}")
    else:
        print(f"{'TC_P2':<8} | {'Enter Outreach Stage':<30} | {'Incorrect Stage':<15} | {'Fail'}")
except: print(f"{'TC_P2':<8} | {'Enter Outreach Stage':<30} | {'Script Error':<15} | {'Fail'}")

# TC_P3: Clinical Matching (Stage 5)
try:
    # Jump to Stage 5 for speed (since we are testing fields)
    safe_click("//button[contains(., '5')]") # Click circle 5 in stepper
    time.sleep(1)
    
    wait.until(EC.presence_of_element_located((By.XPATH, "//textarea[@placeholder=\"Patient's medical history...\"]"))).send_keys("History of hypertension.")
    driver.find_element(By.XPATH, "//select[contains(., 'Select Hospital')]").send_keys("Fortis Memorial Research Institute", Keys.ENTER)
    driver.find_element(By.XPATH, "//select[contains(., 'Select Surgeon')]").send_keys("Dr. Neha", Keys.ENTER)
    
    safe_click("//button[contains(., 'Finalize Clinical Review')]")
    time.sleep(2)
    
    if "Stage 6" in driver.page_source:
        print(f"{'TC_P3':<8} | {'Complete Clinical Review':<30} | {'Stage 6 Active':<15} | {'Success'}")
    else:
        print(f"{'TC_P3':<8} | {'Complete Clinical Review':<30} | {'Not updated':<15} | {'Fail'}")
except: print(f"{'TC_P3':<8} | {'Complete Clinical Review':<30} | {'Script Error':<15} | {'Fail'}")

# TC_P4: Quotation Builder (Stage 6)
try:
    safe_click("//button[contains(., 'Add Line Item')]")
    wait.until(EC.presence_of_element_located((By.XPATH, "//input[@placeholder='Description']"))).send_keys("Hospital Stay (3 Days)")
    driver.find_element(By.XPATH, "//input[@placeholder='Rate']").send_keys("1500")
    
    safe_click("//button[contains(text(), 'Agreed')]")
    time.sleep(1)
    
    if "Agreed" in driver.page_source:
        print(f"{'TC_P4':<8} | {'Quotation & Decision':<30} | {'Data Saved':<15} | {'Success'}")
    else:
        print(f"{'TC_P4':<8} | {'Quotation & Decision':<30} | {'Not saved':<15} | {'Fail'}")
except: print(f"{'TC_P4':<8} | {'Quotation & Decision':<30} | {'Script Error':<15} | {'Fail'}")

# TC_P5: Drop-off Analysis (Stage 9)
try:
    safe_click("//button[contains(., 'Drop Lead')]")
    time.sleep(1)
    
    driver.find_element(By.XPATH, "//select[contains(., 'Select reason...')]").send_keys("Price Too High")
    safe_click("//button[contains(., 'Confirm Drop-off')]")
    time.sleep(2)
    
    if "Archived" in driver.page_source or "Dropped" in driver.page_source:
        print(f"{'TC_P5':<8} | {'Lead Archival':<30} | {'Status: Lost':<15} | {'Success'}")
    else:
        print(f"{'TC_P5':<8} | {'Lead Archival':<30} | {'Not Archived':<15} | {'Fail'}")
except: print(f"{'TC_P5':<8} | {'Lead Archival':<30} | {'Script Error':<15} | {'Fail'}")

# TC_P6: Lead Restoration
try:
    # Look for the restore button in the detail pane header
    safe_click("//button[contains(., 'Restore Lead')]")
    time.sleep(2)
    
    if "Stage 1" in driver.page_source:
        print(f"{'TC_P6':<8} | {'Re-activate Lead':<30} | {'Restored to S1':<15} | {'Success'}")
    else:
        print(f"{'TC_P6':<8} | {'Re-activate Lead':<30} | {'Still Lost':<15} | {'Fail'}")
except: print(f"{'TC_P6':<8} | {'Re-activate Lead':<30} | {'Script Error':<15} | {'Fail'}")

# TC_P7: Board Filter Search
try:
    safe_click("//button[@aria-label='Close'] | //button[contains(., 'X')]") # Close detail pane
    time.sleep(1)
    
    search = driver.find_element(By.XPATH, "//input[@placeholder='Search leads, clinical interests, or origin...']")
    search.clear()
    search.send_keys("NonExistentPatientXYZ")
    time.sleep(1.5)
    
    if "NonExistentPatientXYZ" not in driver.page_source:
        print(f"{'TC_P7':<8} | {'Global Search Filter':<30} | {'Filtered OK':<15} | {'Success'}")
    else:
        print(f"{'TC_P7':<8} | {'Global Search Filter':<30} | {'Failed Filter':<15} | {'Fail'}")
except: print(f"{'TC_P7':<8} | {'Global Search Filter':<30} | {'Script Error':<15} | {'Fail'}")

# TC_P8: View Mode Toggle
try:
    safe_click("//button[contains(., 'Table')]")
    time.sleep(1)
    if "Inquiry ID & Patient" in driver.page_source:
        print(f"{'TC_P8':<8} | {'Switch to Table View':<30} | {'Table Shown':<15} | {'Success'}")
    else:
        print(f"{'TC_P8':<8} | {'Switch to Table View':<30} | {'Switch Failed':<15} | {'Fail'}")
    
    safe_click("//button[contains(., 'Board')]")
    time.sleep(1)
except: print(f"{'TC_P8':<8} | {'Switch View Mode':<30} | {'Script Error':<15} | {'Fail'}")

# TC_P9: Dashboard KPI Validation
try:
    # Check if top stats cards are visible
    total_leads = driver.find_element(By.XPATH, "//*[contains(text(), 'Total Leads')]/..//h3")
    if total_leads.is_displayed():
        print(f"{'TC_P9':<8} | {'KPI Dashboard Load':<30} | {'Stats Visible':<15} | {'Success'}")
    else:
        print(f"{'TC_P9':<8} | {'KPI Dashboard Load':<30} | {'Stats Hidden':<15} | {'Fail'}")
except: print(f"{'TC_P9':<8} | {'KPI Dashboard Load':<30} | {'Script Error':<15} | {'Fail'}")

# TC_P10: HIPAA Session Security
try:
    banner = driver.find_element(By.XPATH, "//*[contains(text(), 'Active HIPAA Session')]")
    if banner.is_displayed():
        print(f"{'TC_P10':<8} | {'Security Banner Check':<30} | {'HIPAA Active':<15} | {'Success'}")
    else:
        print(f"{'TC_P10':<8} | {'Security Banner Check':<30} | {'Banner Missing':<15} | {'Fail'}")
except: print(f"{'TC_P10':<8} | {'Security Banner Check':<30} | {'Script Error':<15} | {'Fail'}")

print("====================================")
driver.quit()
