from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

BASE_URL = "http://localhost:3001"
LOGIN_URL = f"{BASE_URL}/#/login"
EMAIL = "karthik19rathod@gmail.com"
PASSWORD = "Karthik@19"

print("Starting Login Test...")
driver = webdriver.Chrome()
wait = WebDriverWait(driver, 15)

try:
    driver.get(LOGIN_URL)
    print(f"Page loaded: {driver.title}")
    
    email_field = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@id='adminEmail']")))
    email_field.send_keys(EMAIL)
    print("Email entered")
    
    pass_field = driver.find_element(By.XPATH, "//input[@id='adminPassword']")
    pass_field.send_keys(PASSWORD)
    print("Password entered")
    
    driver.find_element(By.XPATH, "//button[@type='submit']").click()
    print("Login button clicked")
    
    wait.until(EC.url_contains("#/"))
    print(f"Login Success! Current URL: {driver.current_url}")
    
except Exception as e:
    print(f"Login Failed: {e}")
    driver.save_screenshot("login_error.png")
finally:
    driver.quit()
