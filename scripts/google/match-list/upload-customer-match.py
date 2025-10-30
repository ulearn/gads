#!/usr/bin/env python3
"""
Google Ads Customer Match Uploader (Python Helper)
Called from Node.js with pre-hashed contact data

Usage:
  python3 upload-customer-match.py <json_file> <action>

  json_file: Path to JSON file with contact operations
  action: 'create' (add contacts) or 'remove' (remove contacts)
"""

import sys
import json
import os
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

# Configuration from environment
CUSTOMER_ID = os.getenv('GADS_ACCOUNT_ID', '4782061099')
USER_LIST_ID = os.getenv('CUSTOMER_MATCH_LIST_ID', '9242598255')
BATCH_SIZE = 5000

def create_google_ads_client():
    """Create Google Ads API client using OAuth2 from environment"""
    credentials = {
        "developer_token": os.getenv('GAdsAPI'),
        "client_id": os.getenv('CLIENT_ID'),
        "client_secret": os.getenv('CLIENT_SECRET'),
        "refresh_token": os.getenv('GOOGLE_REFRESH_TOKEN'),
        "login_customer_id": os.getenv('GADS_LIVE_MCC_ID'),
        "use_proto_plus": True
    }

    return GoogleAdsClient.load_from_dict(credentials, version="v22")

def upload_contacts(client, customer_id, user_list_id, operations, is_removal=False):
    """
    Upload contacts to Customer Match list using OfflineUserDataJobService

    Args:
        client: GoogleAdsClient instance
        customer_id: Google Ads customer ID
        user_list_id: User list ID to update
        operations: List of contact operations with userIdentifiers
        is_removal: True to remove contacts, False to add

    Returns:
        Resource name of created job
    """
    offline_user_data_job_service = client.get_service("OfflineUserDataJobService")

    # Step 1: Create OfflineUserDataJob
    user_list_resource_name = client.get_service("UserListService").user_list_path(
        customer_id, user_list_id
    )

    job = client.get_type("OfflineUserDataJob")
    job.type_ = client.enums.OfflineUserDataJobTypeEnum.CUSTOMER_MATCH_USER_LIST
    job.customer_match_user_list_metadata.user_list = user_list_resource_name

    create_job_response = offline_user_data_job_service.create_offline_user_data_job(
        customer_id=customer_id,
        job=job
    )

    job_resource_name = create_job_response.resource_name
    print(f"Created OfflineUserDataJob: {job_resource_name}")

    # Step 2: Add operations in batches
    total_ops = len(operations)
    for i in range(0, total_ops, BATCH_SIZE):
        batch = operations[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        total_batches = (total_ops + BATCH_SIZE - 1) // BATCH_SIZE

        print(f"  Uploading batch {batch_num}/{total_batches} ({len(batch)} contacts)...")

        # Convert operations to gRPC format
        user_data_operations = []
        for op_data in batch:
            user_data_operation = client.get_type("OfflineUserDataJobOperation")
            user_data = build_offline_user_data(client, op_data)

            if is_removal:
                user_data_operation.remove = user_data
            else:
                user_data_operation.create = user_data

            user_data_operations.append(user_data_operation)

        # Add operations to job
        request = client.get_type("AddOfflineUserDataJobOperationsRequest")
        request.resource_name = job_resource_name
        request.operations = user_data_operations
        request.enable_partial_failure = True

        offline_user_data_job_service.add_offline_user_data_job_operations(
            request=request
        )

    # Step 3: Run the job
    print(f"  Running job...")
    offline_user_data_job_service.run_offline_user_data_job(
        resource_name=job_resource_name
    )

    print(f"✅ {'Removal' if is_removal else 'Upload'} job submitted successfully ({total_ops} contacts)")
    print(f"Job resource name: {job_resource_name}")

    return job_resource_name

def build_offline_user_data(client, op_data):
    """Build OfflineUserData from operation data"""
    user_data = client.get_type("UserData")

    for identifier in op_data.get("user_identifiers", []):
        user_id = client.get_type("UserIdentifier")

        if "hashed_email" in identifier:
            user_id.hashed_email = identifier["hashed_email"]
        if "hashed_phone_number" in identifier:
            user_id.hashed_phone_number = identifier["hashed_phone_number"]

        user_data.user_identifiers.append(user_id)

    return user_data

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 upload-customer-match.py <json_file> <action>")
        print("  action: 'create' or 'remove'")
        sys.exit(1)

    json_file = sys.argv[1]
    action = sys.argv[2]
    is_removal = (action == 'remove')

    # Load operations from JSON
    with open(json_file, 'r') as f:
        data = json.load(f)

    operations = data.get('operations', [])
    print(f"Loaded {len(operations)} operations from {json_file}")

    # Create client and upload
    try:
        client = create_google_ads_client()
        job_resource_name = upload_contacts(
            client,
            CUSTOMER_ID,
            USER_LIST_ID,
            operations,
            is_removal
        )

        print(f"\nSUCCESS: Job {job_resource_name}")
        print("Changes may take 12-48 hours to populate in Google Ads")

    except GoogleAdsException as ex:
        print(f"❌ Google Ads API Error:")
        for error in ex.failure.errors:
            print(f"  Error: {error.message}")
            if error.location:
                for field_path_element in error.location.field_path_elements:
                    print(f"  Field: {field_path_element.field_name}")
        sys.exit(1)
    except Exception as ex:
        print(f"❌ Error: {ex}")
        sys.exit(1)

if __name__ == "__main__":
    main()
