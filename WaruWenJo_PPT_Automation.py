from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import os

# --- CONFIGURATION ---
BASE_URL = "http://localhost:3001"
LOGIN_URL = f"{BASE_URL}/#/login"
EMAIL = "karthik19rathod@gmail.com"
PASSWORD = "Karthik@19"
SCREENSHOT_DIR = "automation_screenshots"

if not os.path.exists(SCREENSHOT_DIR):
    os.makedirs(SCREENSHOT_DIR)

driver = webdriver.Chrome()
driver.maximize_window()
wait = WebDriverWait(driver, 20)

def complete_checklist():
    try:
        time.sleep(1)
        tasks = driver.find_elements(By.XPATH, "//div[contains(@class, 'cursor-pointer') and contains(@class, 'border-slate-100')]")
        for task in tasks:
            # Check if already completed (bg-teal-50)
            if "bg-teal-50" not in task.get_attribute("class"):
                driver.execute_script("arguments[0].click();", task)
                time.sleep(0.3)
    except:
        pass

def safe_click(xpath):
    try:
        element = wait.until(EC.element_to_be_clickable((By.XPATH, xpath)))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        time.sleep(0.5)
        element.click()
    except Exception:
        element = driver.find_element(By.XPATH, xpath)
        driver.execute_script("arguments[0].click();", element)

def safe_type(xpath, text):
    element = wait.until(EC.visibility_of_element_located((By.XPATH, xpath)))
    element.clear()
    element.send_keys(text)

def take_ss(name):
    time.sleep(1.5) # Wait for animations
    driver.save_screenshot(os.path.join(SCREENSHOT_DIR, f"{name}.png"))

results = []

try:
    # 1. LOGIN
    driver.get(LOGIN_URL)
    time.sleep(2)
    safe_type("//input[@id='adminEmail']", EMAIL)
    safe_type("//input[@id='adminPassword']", PASSWORD)
    take_ss("0_login_page")
    safe_click("//button[@type='submit']")
    
    # Wait for Dashboard
    wait.until(EC.presence_of_element_located((By.XPATH, "//h2[contains(text(), 'Operation Command')]")))
    time.sleep(2)
    take_ss("1_dashboard")

    # Navigate to Patient Leads via Hash
    driver.execute_script("window.location.hash = '#/patient-leads'")
    time.sleep(4)
    take_ss("2_patient_leads_board")

    patient_name = f"PPT_TEST_{int(time.time() % 10000)}"

    # --- STAGE 1: TRIAGE ---
    try:
        # Use JS to click the button if it's tricky
        driver.execute_script("document.querySelectorAll('button').forEach(b => { if(b.innerText.includes('New Intake')) b.click(); })")
        time.sleep(2)
        safe_type("//label[contains(text(), 'Full Name')]/..//input", patient_name)
        safe_type("//label[contains(text(), 'Email Address')]/..//input", "patient@waruwenjo.com")
        safe_type("//label[contains(text(), 'Nationality')]/..//input", "Germany")
        safe_type("//label[contains(text(), 'Clinical Interest')]/..//input", "Orthopedics")
        take_ss("stage1_intake_form")
        safe_click("//button[contains(text(), 'Onboard Inquiry')]")
        time.sleep(3)
        # Find and open
        safe_click(f"//h4[contains(text(), '{patient_name}')]")
        time.sleep(1.5)
        take_ss("stage1_detail_pane")
        complete_checklist()
        take_ss("stage1_checklist_done")
        results.append(["TC_S1", "Triage / Intake", "Success"])
    except Exception as e: results.append(["TC_S1", "Triage / Intake", f"Fail: {str(e)[:15]}"])

    # --- STAGE 2: OUTREACH ---
    try:
        safe_click("//button[contains(., 'Move to Outreach')]")
        time.sleep(2)
        take_ss("stage2_workspace")
        complete_checklist()
        take_ss("stage2_checklist_done")
        results.append(["TC_S2", "Outreach", "Success"])
    except Exception as e: results.append(["TC_S2", "Outreach", "Fail"])

    # --- STAGE 3: DISCOVERY ---
    try:
        safe_click("//button[contains(., 'Progress to Discovery')]")
        time.sleep(2)
        take_ss("stage3_workspace")
        complete_checklist()
        take_ss("stage3_checklist_done")
        results.append(["TC_S3", "Discovery", "Success"])
    except Exception as e: results.append(["TC_S3", "Discovery", "Fail"])

    # --- STAGE 4: DOCUMENTATION ---
    try:
        safe_click("//button[contains(., 'Move to Documentation')]")
        time.sleep(2)
        take_ss("stage4_workspace")
        complete_checklist()
        take_ss("stage4_checklist_done")
        results.append(["TC_S4", "Documentation", "Success"])
    except Exception as e: results.append(["TC_S4", "Documentation", "Fail"])

    # --- STAGE 5: CLINICAL ---
    try:
        # Assign Doctor
        driver.find_element(By.XPATH, "//select[contains(., 'Select In-House Doctor')]").send_keys("Dr. Rajesh Kumar")
        safe_click("//button[contains(., 'Send to In-House Doctor')]")
        time.sleep(2)
        try: driver.switch_to.alert.accept()
        except: pass
        take_ss("stage5_workspace")
        complete_checklist()
        take_ss("stage5_checklist_done")
        results.append(["TC_S5", "Clinical Review", "Success"])
    except Exception as e: results.append(["TC_S5", "Clinical Review", "Fail"])

    # --- STAGE 6: NEGOTIATION ---
    try:
        driver.find_element(By.XPATH, "//select[contains(., 'Select Hospital')]").send_keys("Fortis", Keys.ENTER)
        driver.find_element(By.XPATH, "//select[contains(., 'Select Surgeon')]").send_keys("Dr. Neha", Keys.ENTER)
        safe_click("//button[contains(., 'Finalize Clinical Review')]")
        time.sleep(2)
        take_ss("stage6_workspace")
        complete_checklist()
        take_ss("stage6_checklist_done")
        results.append(["TC_S6", "Negotiation", "Success"])
    except Exception as e: results.append(["TC_S6", "Negotiation", "Fail"])

    # --- STAGE 7: VIDEO CALL ---
    try:
        safe_click("//button[contains(text(), 'Agreed')]")
        safe_click("//button[contains(., 'Send Meeting Slots')]")
        time.sleep(2)
        try: driver.switch_to.alert.accept()
        except: pass
        take_ss("stage7_workspace")
        complete_checklist()
        take_ss("stage7_checklist_done")
        results.append(["TC_S7", "Video Call", "Success"])
    except Exception as e: results.append(["TC_S7", "Video Call", "Fail"])

    # --- STAGE 8: WON ---
    try:
        safe_type("//input[contains(@placeholder, 'Tomorrow')]", "Next Week Monday 10AM")
        safe_click("//button[contains(., 'Schedule Video Consultation')]")
        time.sleep(2)
        take_ss("stage8_workspace")
        complete_checklist()
        take_ss("stage8_checklist_done")
        results.append(["TC_S8", "Won / Converted", "Success"])
    except Exception as e: results.append(["TC_S8", "Won / Converted", "Fail"])

    # --- STAGE 9: ARCHIVED ---
    try:
        safe_click("//button[contains(., 'Drop Lead')]")
        driver.find_element(By.XPATH, "//select[contains(., 'reason')]").send_keys("Price Too High")
        time.sleep(1)
        take_ss("stage9_dropoff_form")
        safe_click("//button[contains(., 'Confirm Drop-off')]")
        time.sleep(2)
        take_ss("stage9_archived")
        results.append(["TC_S9", "Lost / Dropped", "Success"])
    except Exception as e: results.append(["TC_S9", "Lost / Dropped", "Fail"])

except Exception as e:
    print(f"Automation Critical Error: {e}")

print("\nFinal Results for PPT Generation:")
for res in results:
    print(f"{res[0]} | {res[1]:<20} | {res[2]}")

driver.quit()
