import firebase_admin
from firebase_admin import credentials, firestore
import os

# Initialize Firebase Admin SDK
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {
    'projectId': 'plane-alert-800ff',
})

db = firestore.client()

device_id = 'u4h7b5hnvdgvozqd5yzm86i474fs4g__galaxys24'

# Dieselstraße 8, Unterföhring, 85774 coordinates  
new_location = {
    'lat': 48.1896,
    'lon': 11.6490
}

try:
    # Get current device data
    doc_ref = db.collection('devices').document(device_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        print(f'❌ Device not found: {device_id}')
    else:
        current_data = doc.to_dict()
        print('📱 Current device data:')
        print(f'   Device: {current_data.get("deviceName")}')
        print(f'   Current location: {current_data.get("location")}')
        
        # Update location
        doc_ref.update({
            'location': new_location,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        print('\n✅ Location updated successfully!')
        print(f'   New location: {new_location}')
        print('   Address: Dieselstraße 8, Unterföhring, 85774')
        
except Exception as error:
    print(f'❌ Error updating location: {error}')
