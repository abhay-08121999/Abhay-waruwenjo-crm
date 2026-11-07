import time
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

def extract_fields():
    print("Starting driver...")
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--window-size=1920,1080")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    wait = WebDriverWait(driver, 15)
    
    try:
        # Login
        print("Logging in...")
        driver.get("https://admin.waruwenjo.com/#/")
        
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email'] | //input[@placeholder='Email'] | //input[@name='email']")))
        email_input.send_keys("karthik19rathod@gmail.com")
        
        pass_input = driver.find_element(By.XPATH, "//input[@type='password'] | //input[@placeholder='Password'] | //input[@name='password']")
        pass_input.send_keys("Karthik@19")
        
        login_btn = driver.find_element(By.XPATH, "//button[@type='submit' or contains(text(), 'Login') or contains(text(), 'Sign in')]")
        login_btn.click()
        
        time.sleep(5)
        
        # Navigate to Doctors module
        print("Navigating to Doctors...")
        driver.get("https://admin.waruwenjo.com/#/doctors")
        time.sleep(4)
        
        print("Current URL in doctors:", driver.current_url)
        
        # Click Add Doctor
        print("Clicking Add Doctor...")
        try:
            add_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'add') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'new')]")))
            add_btn.click()
            time.sleep(3)
        except Exception as e:
            print("Could not click add/new button:", e)
        
        # Extract fields
        print("\n--- Form Fields (Labels, Inputs, Textareas, Selects) ---")
        
        labels = driver.find_elements(By.TAG_NAME, "label")
        print("\nFound Labels:")
        for lbl in labels:
            print(f"- {lbl.text}")
            
        elements = driver.find_elements(By.XPATH, "//div[contains(@class, 'fixed')]//input | //div[contains(@class, 'fixed')]//textarea | //div[contains(@class, 'fixed')]//select")
        if not elements:
             # Fallback if no modal is used
             elements = driver.find_elements(By.XPATH, "//input | //textarea | //select")
             
        print("\nFound Inputs/Textareas/Selects:")
        for el in elements:
            tag = el.tag_name
            name = el.get_attribute("name")
            placeholder = el.get_attribute("placeholder")
            type_attr = el.get_attribute("type")
            id_attr = el.get_attribute("id")
            
            print(f"Tag: {tag}, Type: {type_attr}, Name: {name}, Placeholder: {placeholder}, ID: {id_attr}")
            
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    extract_fields()
