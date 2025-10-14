-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Sep 11, 2025 at 02:49 PM
-- Server version: 8.0.37
-- PHP Version: 8.3.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `hub_gads`
--

-- --------------------------------------------------------

--
-- Table structure for table `campaign_geo_targeting`
--

CREATE TABLE `campaign_geo_targeting` (
  `targeting_id` int NOT NULL,
  `campaign_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `country_code` char(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `included_cities` json DEFAULT NULL,
  `excluded_cities` json DEFAULT NULL,
  `gdp_threshold` tinyint DEFAULT '7',
  `language` char(2) COLLATE utf8mb4_unicode_ci DEFAULT 'en',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `campaign_targeting_summary`
-- (See below for the actual view)
--
CREATE TABLE `campaign_targeting_summary` (
`campaign_name` varchar(100)
,`language` char(2)
,`target_countries` mediumtext
,`country_count` bigint
,`avg_gdp_threshold` decimal(7,4)
);

-- --------------------------------------------------------

--
-- Table structure for table `country_rules`
--

CREATE TABLE `country_rules` (
  `country_code` char(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `country_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('green','yellow','red') COLLATE utf8mb4_unicode_ci NOT NULL,
  `visa_required` tinyint(1) NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ecl_logs`
--

CREATE TABLE `ecl_logs` (
  `id` int NOT NULL,
  `deal_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stage` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adjustment_value` decimal(10,2) DEFAULT NULL,
  `gclid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rejection_reason` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_mql_rejection` tinyint(1) DEFAULT '0',
  `success` tinyint(1) DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `payload` json DEFAULT NULL,
  `result` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `adjustment_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `currency_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `processing_time_ms` int DEFAULT NULL,
  `phone_cleaned` tinyint(1) DEFAULT '0',
  `validation_summary` text COLLATE utf8mb4_unicode_ci,
  `google_results_count` int DEFAULT '0',
  `google_partial_failure_error` text COLLATE utf8mb4_unicode_ci,
  `google_request_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `google_raw_response` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gads_campaigns`
--

CREATE TABLE `gads_campaigns` (
  `campaign_id` int NOT NULL,
  `google_campaign_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_type` tinyint NOT NULL COMMENT '2=Search, 3=Display, 10=Performance Max',
  `campaign_type_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` tinyint NOT NULL COMMENT '2=ENABLED, 3=PAUSED, 4=REMOVED',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `bidding_strategy` tinyint DEFAULT NULL,
  `budget_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `budget_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `daily_budget_micros` bigint DEFAULT NULL,
  `daily_budget_eur` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `gads_campaign_lifecycle`
-- (See below for the actual view)
--
CREATE TABLE `gads_campaign_lifecycle` (
`google_campaign_id` varchar(50)
,`campaign_name` varchar(255)
,`campaign_type_name` varchar(50)
,`current_status` tinyint
,`start_date` date
,`end_date` date
,`first_tracked_date` timestamp
,`last_activated_date` timestamp
,`last_paused_date` timestamp
,`total_status_changes` bigint
,`days_since_last_change` int
,`days_in_current_status` int
);

-- --------------------------------------------------------

--
-- Table structure for table `gads_campaign_metrics`
--

CREATE TABLE `gads_campaign_metrics` (
  `metric_id` int NOT NULL,
  `google_campaign_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `impressions` int DEFAULT '0',
  `clicks` int DEFAULT '0',
  `cost_micros` bigint DEFAULT '0',
  `cost_eur` decimal(10,2) DEFAULT '0.00',
  `conversions` decimal(8,2) DEFAULT '0.00',
  `view_through_conversions` int DEFAULT '0',
  `ctr` decimal(5,2) DEFAULT '0.00' COMMENT 'Click-through rate %',
  `cpc_micros` bigint DEFAULT '0',
  `cpc_eur` decimal(6,2) DEFAULT '0.00' COMMENT 'Cost per click',
  `conversion_rate` decimal(5,2) DEFAULT '0.00' COMMENT 'Conversion rate %',
  `cost_per_conversion_eur` decimal(8,2) DEFAULT '0.00',
  `synced_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gads_campaign_status_history`
--

CREATE TABLE `gads_campaign_status_history` (
  `history_id` int NOT NULL,
  `google_campaign_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_status` tinyint DEFAULT NULL COMMENT 'Previous status',
  `new_status` tinyint NOT NULL COMMENT 'New status: 2=ENABLED, 3=PAUSED, 4=REMOVED',
  `old_status_name` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status_name` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status_changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `detected_by_sync` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Which sync detected this change',
  `sync_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `gads_campaign_summary_30d`
-- (See below for the actual view)
--
CREATE TABLE `gads_campaign_summary_30d` (
`google_campaign_id` varchar(50)
,`campaign_name` varchar(255)
,`campaign_type_name` varchar(50)
,`status` tinyint
,`daily_budget_eur` decimal(10,2)
,`days_with_data` bigint
,`total_impressions` decimal(32,0)
,`total_clicks` decimal(32,0)
,`total_cost` decimal(32,2)
,`total_conversions` decimal(30,2)
,`avg_ctr` decimal(9,6)
,`avg_cpc` decimal(10,6)
,`avg_conversion_rate` decimal(9,6)
,`last_activity_date` date
);

-- --------------------------------------------------------

--
-- Table structure for table `gads_geo_targeting`
--

CREATE TABLE `gads_geo_targeting` (
  `targeting_id` int NOT NULL,
  `google_campaign_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `geo_target_constant` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country_code` char(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Country, City, Region',
  `is_negative` tinyint(1) DEFAULT '0' COMMENT '0=Included, 1=Excluded',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gads_keywords`
--

CREATE TABLE `gads_keywords` (
  `keyword_id` int NOT NULL,
  `google_campaign_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `google_adgroup_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keyword_text` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `match_type` tinyint NOT NULL COMMENT '1=EXACT, 2=PHRASE, 3=BROAD, 4=BROAD_MATCH_MODIFIER',
  `match_type_name` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` tinyint DEFAULT '2' COMMENT '2=ENABLED, 3=PAUSED, 4=REMOVED',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gads_keyword_metrics`
--

CREATE TABLE `gads_keyword_metrics` (
  `metric_id` int NOT NULL,
  `keyword_id` int NOT NULL,
  `date` date NOT NULL,
  `impressions` int DEFAULT '0',
  `clicks` int DEFAULT '0',
  `cost_micros` bigint DEFAULT '0',
  `cost_eur` decimal(8,2) DEFAULT '0.00',
  `conversions` decimal(6,2) DEFAULT '0.00',
  `ctr` decimal(5,2) DEFAULT '0.00',
  `cpc_eur` decimal(6,2) DEFAULT '0.00',
  `average_position` decimal(3,1) DEFAULT NULL,
  `synced_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `gads_pipeline_summary`
-- (See below for the actual view)
--
CREATE TABLE `gads_pipeline_summary` (
`report_date` date
,`total_impressions` decimal(32,0)
,`total_clicks` decimal(32,0)
,`total_cost` decimal(32,2)
,`total_conversions` decimal(30,2)
,`active_campaigns` bigint
,`avg_ctr` decimal(9,6)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `gads_recent_status_changes`
-- (See below for the actual view)
--
CREATE TABLE `gads_recent_status_changes` (
`google_campaign_id` varchar(50)
,`campaign_name` varchar(255)
,`old_status_name` varchar(20)
,`new_status_name` varchar(20)
,`status_changed_at` timestamp
,`detected_by_sync` varchar(50)
,`days_ago` int
);

-- --------------------------------------------------------

--
-- Table structure for table `gads_sync_log`
--

CREATE TABLE `gads_sync_log` (
  `sync_id` int NOT NULL,
  `sync_type` enum('campaigns','metrics','keywords','targeting','full') COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `campaigns_synced` int DEFAULT '0',
  `metrics_synced` int DEFAULT '0',
  `keywords_synced` int DEFAULT '0',
  `status` enum('running','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'running',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `api_calls_used` int DEFAULT '0',
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `geo_targets`
--

CREATE TABLE `geo_targets` (
  `geo_id` int NOT NULL,
  `country_code` char(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gdp_score` tinyint DEFAULT NULL,
  `geo_weight` decimal(3,2) DEFAULT '1.00',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ;

-- --------------------------------------------------------

--
-- Table structure for table `hub_companies`
--

CREATE TABLE `hub_companies` (
  `company_id` int NOT NULL,
  `hubspot_company_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `domain` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `industry` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdate` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hs_lastmodifieddate` datetime DEFAULT NULL,
  `hs_object_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hub_contacts`
--

CREATE TABLE `hub_contacts` (
  `contact_id` int NOT NULL,
  `hubspot_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` text COLLATE utf8mb4_unicode_ci,
  `firstname` text COLLATE utf8mb4_unicode_ci,
  `lastname` text COLLATE utf8mb4_unicode_ci,
  `phone` text COLLATE utf8mb4_unicode_ci,
  `country_code` char(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` text COLLATE utf8mb4_unicode_ci,
  `pipeline_stage` tinyint DEFAULT '0',
  `lifecyclestage` text COLLATE utf8mb4_unicode_ci,
  `hs_lead_status` text COLLATE utf8mb4_unicode_ci,
  `source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_detail_1` text COLLATE utf8mb4_unicode_ci,
  `source_detail_2` text COLLATE utf8mb4_unicode_ci,
  `createdate` datetime DEFAULT NULL,
  `lastmodifieddate` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hs_object_id` int DEFAULT NULL,
  `agent` text COLLATE utf8mb4_unicode_ci,
  `chattedbefore` text COLLATE utf8mb4_unicode_ci,
  `hs_all_accessible_team_ids` text COLLATE utf8mb4_unicode_ci,
  `hs_all_contact_vids` bigint DEFAULT NULL,
  `hs_all_owner_ids` int DEFAULT NULL,
  `hs_all_team_ids` int DEFAULT NULL,
  `hs_analytics_average_page_views` int DEFAULT NULL,
  `hs_analytics_first_timestamp` datetime DEFAULT NULL,
  `hs_analytics_num_event_completions` int DEFAULT NULL,
  `hs_analytics_num_page_views` int DEFAULT NULL,
  `hs_analytics_num_visits` int DEFAULT NULL,
  `hs_analytics_revenue` int DEFAULT NULL,
  `hs_analytics_source` text COLLATE utf8mb4_unicode_ci,
  `hs_analytics_source_data_1` text COLLATE utf8mb4_unicode_ci,
  `hs_analytics_source_data_2` text COLLATE utf8mb4_unicode_ci,
  `hs_associated_target_accounts` int DEFAULT NULL,
  `hs_count_is_unworked` int DEFAULT NULL,
  `hs_count_is_worked` int DEFAULT NULL,
  `hs_currently_enrolled_in_prospecting_agent` tinyint(1) DEFAULT NULL,
  `hs_email_domain` text COLLATE utf8mb4_unicode_ci,
  `hs_first_outreach_date` datetime DEFAULT NULL,
  `hs_full_name_or_email` text COLLATE utf8mb4_unicode_ci,
  `hs_is_contact` tinyint(1) DEFAULT NULL,
  `hs_is_unworked` tinyint(1) DEFAULT NULL,
  `hs_latest_source` text COLLATE utf8mb4_unicode_ci,
  `hs_latest_source_data_1` text COLLATE utf8mb4_unicode_ci,
  `hs_latest_source_data_2` text COLLATE utf8mb4_unicode_ci,
  `hs_latest_source_timestamp` datetime DEFAULT NULL,
  `hs_marketable_status` tinyint(1) DEFAULT NULL,
  `hs_marketable_until_renewal` tinyint(1) DEFAULT NULL,
  `hs_membership_has_accessed_private_content` int DEFAULT NULL,
  `hs_messaging_engagement_score` decimal(15,6) DEFAULT NULL,
  `hs_notes_last_activity` text COLLATE utf8mb4_unicode_ci,
  `hs_object_source` text COLLATE utf8mb4_unicode_ci,
  `hs_object_source_id` text COLLATE utf8mb4_unicode_ci,
  `hs_object_source_label` text COLLATE utf8mb4_unicode_ci,
  `hs_pipeline` text COLLATE utf8mb4_unicode_ci,
  `hs_prospecting_agent_actively_enrolled_count` int DEFAULT NULL,
  `hs_prospecting_agent_total_enrolled_count` int DEFAULT NULL,
  `hs_registered_member` int DEFAULT NULL,
  `hs_sales_email_last_replied` datetime DEFAULT NULL,
  `hs_sequences_actively_enrolled_count` int DEFAULT NULL,
  `hs_social_facebook_clicks` int DEFAULT NULL,
  `hs_social_google_plus_clicks` int DEFAULT NULL,
  `hs_social_linkedin_clicks` int DEFAULT NULL,
  `hs_social_num_broadcast_clicks` int DEFAULT NULL,
  `hs_social_twitter_clicks` int DEFAULT NULL,
  `hs_user_ids_of_all_owners` int DEFAULT NULL,
  `hs_v2_date_entered_lead` datetime DEFAULT NULL,
  `hubspot_owner_assigneddate` datetime DEFAULT NULL,
  `hubspot_owner_id` int DEFAULT NULL,
  `hubspot_team_id` int DEFAULT NULL,
  `notes_last_updated` datetime DEFAULT NULL,
  `num_contacted_notes` int DEFAULT NULL,
  `num_conversion_events` int DEFAULT NULL,
  `num_notes` int DEFAULT NULL,
  `num_unique_conversion_events` int DEFAULT NULL,
  `hs_calculated_mobile_number` bigint DEFAULT NULL,
  `hs_calculated_phone_number` bigint DEFAULT NULL,
  `hs_calculated_phone_number_country_code` text COLLATE utf8mb4_unicode_ci,
  `hs_object_source_detail_1` text COLLATE utf8mb4_unicode_ci,
  `hs_searchable_calculated_mobile_number` int DEFAULT NULL,
  `hs_searchable_calculated_phone_number` int DEFAULT NULL,
  `hs_whatsapp_phone_number` bigint DEFAULT NULL,
  `mobilephone` bigint DEFAULT NULL,
  `hs_first_engagement_object_id` bigint DEFAULT NULL,
  `hs_notes_next_activity` text COLLATE utf8mb4_unicode_ci,
  `hs_notes_next_activity_type` text COLLATE utf8mb4_unicode_ci,
  `hs_sa_first_engagement_date` datetime DEFAULT NULL,
  `hs_sa_first_engagement_descr` text COLLATE utf8mb4_unicode_ci,
  `hs_sa_first_engagement_object_type` text COLLATE utf8mb4_unicode_ci,
  `hs_time_to_first_engagement` int DEFAULT NULL,
  `hs_updated_by_user_id` int DEFAULT NULL,
  `notes_last_contacted` datetime DEFAULT NULL,
  `notes_next_activity_date` datetime DEFAULT NULL,
  `first_deal_created_date` datetime DEFAULT NULL,
  `hs_all_assigned_business_unit_ids` int DEFAULT NULL,
  `hs_created_by_user_id` int DEFAULT NULL,
  `hs_last_sales_activity_date` datetime DEFAULT NULL,
  `hs_last_sales_activity_timestamp` datetime DEFAULT NULL,
  `hs_last_sales_activity_type` text COLLATE utf8mb4_unicode_ci,
  `hs_latest_sequence_enrolled` int DEFAULT NULL,
  `hs_latest_sequence_enrolled_date` datetime DEFAULT NULL,
  `hs_object_source_user_id` int DEFAULT NULL,
  `hs_sales_email_last_opened` datetime DEFAULT NULL,
  `hs_sequences_enrolled_count` int DEFAULT NULL,
  `hs_sequences_is_enrolled` tinyint(1) DEFAULT NULL,
  `hs_time_between_contact_creation_and_deal_creation` int DEFAULT NULL,
  `nationality` text COLLATE utf8mb4_unicode_ci,
  `num_associated_deals` int DEFAULT NULL,
  `territory` text COLLATE utf8mb4_unicode_ci,
  `course_weeks` int DEFAULT NULL,
  `emailed_` text COLLATE utf8mb4_unicode_ci,
  `first_conversion_date` datetime DEFAULT NULL,
  `first_conversion_event_name` text COLLATE utf8mb4_unicode_ci,
  `ga_client_id` decimal(15,6) DEFAULT NULL,
  `ga_session_id` text COLLATE utf8mb4_unicode_ci,
  `hs_analytics_first_referrer` text COLLATE utf8mb4_unicode_ci,
  `hs_analytics_first_url` text COLLATE utf8mb4_unicode_ci,
  `hs_analytics_first_visit_timestamp` datetime DEFAULT NULL,
  `hs_analytics_last_referrer` text COLLATE utf8mb4_unicode_ci,
  `hs_analytics_last_timestamp` datetime DEFAULT NULL,
  `hs_analytics_last_url` text COLLATE utf8mb4_unicode_ci,
  `hs_analytics_last_visit_timestamp` datetime DEFAULT NULL,
  `hs_calculated_form_submissions` text COLLATE utf8mb4_unicode_ci,
  `hs_sales_email_last_clicked` datetime DEFAULT NULL,
  `recent_conversion_date` datetime DEFAULT NULL,
  `gclid` text COLLATE utf8mb4_unicode_ci,
  `message_sum_rich` text COLLATE utf8mb4_unicode_ci,
  `message_summary` text COLLATE utf8mb4_unicode_ci,
  `response` text COLLATE utf8mb4_unicode_ci,
  `response_1` text COLLATE utf8mb4_unicode_ci,
  `hs_calculated_merged_vids` text COLLATE utf8mb4_unicode_ci,
  `hs_latest_sequence_ended_date` datetime DEFAULT NULL,
  `hs_latest_sequence_unenrolled_date` datetime DEFAULT NULL,
  `hs_merged_object_ids` text COLLATE utf8mb4_unicode_ci,
  `hs_v2_cumulative_time_in_lead` int DEFAULT NULL,
  `wa_outreach` text COLLATE utf8mb4_unicode_ci,
  `question` text COLLATE utf8mb4_unicode_ci,
  `hs_created_by_conversations` tinyint(1) DEFAULT NULL,
  `date_of_birth` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_lead` int DEFAULT NULL,
  `state` text COLLATE utf8mb4_unicode_ci,
  `zip` text COLLATE utf8mb4_unicode_ci,
  `hs_latest_meeting_activity` datetime DEFAULT NULL,
  `hs_additional_emails` text COLLATE utf8mb4_unicode_ci,
  `address` text COLLATE utf8mb4_unicode_ci,
  `associatedcompanyid` bigint DEFAULT NULL,
  `country` text COLLATE utf8mb4_unicode_ci,
  `academic_program` text COLLATE utf8mb4_unicode_ci,
  `address_addon` text COLLATE utf8mb4_unicode_ci,
  `age` decimal(15,2) DEFAULT NULL,
  `ai_email_closing` text COLLATE utf8mb4_unicode_ci,
  `ai_email_head_1` text COLLATE utf8mb4_unicode_ci,
  `ai_email_head_2` text COLLATE utf8mb4_unicode_ci,
  `associatedcompanylastupdated` decimal(15,2) DEFAULT NULL,
  `attendance_record` decimal(15,2) DEFAULT NULL,
  `chat_follow` datetime DEFAULT NULL,
  `closedate` datetime DEFAULT NULL,
  `course_end` datetime DEFAULT NULL,
  `course_enrollment_date` datetime DEFAULT NULL,
  `course_graduation_date` datetime DEFAULT NULL,
  `course_start_date` datetime DEFAULT NULL,
  `days_to_close` decimal(15,2) DEFAULT NULL,
  `engagements_last_meeting_booked` datetime DEFAULT NULL,
  `first_deal` datetime DEFAULT NULL,
  `followercount` decimal(15,2) DEFAULT NULL,
  `gpa` decimal(15,2) DEFAULT NULL,
  `grade` decimal(15,2) DEFAULT NULL,
  `hs_content_membership_email_confirmed` tinyint(1) DEFAULT NULL,
  `hs_content_membership_registered_at` datetime DEFAULT NULL,
  `hs_content_membership_registration_email_sent_at` datetime DEFAULT NULL,
  `hs_createdate` datetime DEFAULT NULL,
  `hs_cross_sell_opportunity` tinyint(1) DEFAULT NULL,
  `hs_data_privacy_ads_consent` tinyint(1) DEFAULT NULL,
  `hs_document_last_revisited` datetime DEFAULT NULL,
  `hs_email_bad_address` tinyint(1) DEFAULT NULL,
  `hs_email_bounce` decimal(15,2) DEFAULT NULL,
  `hs_email_click` decimal(15,2) DEFAULT NULL,
  `hs_email_delivered` decimal(15,2) DEFAULT NULL,
  `hs_email_last_reply_date` datetime DEFAULT NULL,
  `hs_email_last_send_date` datetime DEFAULT NULL,
  `hs_email_open` decimal(15,2) DEFAULT NULL,
  `hs_email_optout` tinyint(1) DEFAULT NULL,
  `hs_email_quarantined` tinyint(1) DEFAULT NULL,
  `hs_email_recipient_fatigue_recovery_time` datetime DEFAULT NULL,
  `hs_email_replied` decimal(15,2) DEFAULT NULL,
  `hs_email_sends_since_last_engagement` decimal(15,2) DEFAULT NULL,
  `hs_employment_change_detected_date` datetime DEFAULT NULL,
  `hs_enriched_email_bounce_detected` tinyint(1) DEFAULT NULL,
  `hs_facebook_ad_clicked` tinyint(1) DEFAULT NULL,
  `hs_first_closed_order_id` decimal(15,2) DEFAULT NULL,
  `hs_first_order_closed_date` datetime DEFAULT NULL,
  `hs_is_enriched` tinyint(1) DEFAULT NULL,
  `hs_last_metered_enrichment_timestamp` datetime DEFAULT NULL,
  `hs_last_sms_send_date` datetime DEFAULT NULL,
  `hs_lastmodifieddate` datetime DEFAULT NULL,
  `hs_latest_disqualified_lead_date` datetime DEFAULT NULL,
  `hs_latest_open_lead_date` datetime DEFAULT NULL,
  `hs_latest_qualified_lead_date` datetime DEFAULT NULL,
  `hs_latest_sequence_finished_date` datetime DEFAULT NULL,
  `hs_latest_subscription_create_date` datetime DEFAULT NULL,
  `hs_latitude` decimal(15,2) DEFAULT NULL,
  `hs_read_only` tinyint(1) DEFAULT NULL,
  `hs_was_imported` tinyint(1) DEFAULT NULL,
  `currentlyinworkflow` tinyint(1) DEFAULT NULL,
  `ai_email_intro` text COLLATE utf8mb4_unicode_ci,
  `ai_email_subject` text COLLATE utf8mb4_unicode_ci,
  `annualrevenue` text COLLATE utf8mb4_unicode_ci,
  `company` text COLLATE utf8mb4_unicode_ci,
  `company_size` text COLLATE utf8mb4_unicode_ci,
  `contact_notes` text COLLATE utf8mb4_unicode_ci,
  `course_duration` text COLLATE utf8mb4_unicode_ci,
  `course_type` text COLLATE utf8mb4_unicode_ci,
  `degree` text COLLATE utf8mb4_unicode_ci,
  `email_2` text COLLATE utf8mb4_unicode_ci,
  `engagements_last_meeting_booked_campaign` text COLLATE utf8mb4_unicode_ci,
  `engagements_last_meeting_booked_medium` text COLLATE utf8mb4_unicode_ci,
  `engagements_last_meeting_booked_source` text COLLATE utf8mb4_unicode_ci,
  `enrollment_status` text COLLATE utf8mb4_unicode_ci,
  `existing_customer_` text COLLATE utf8mb4_unicode_ci,
  `facebook` text COLLATE utf8mb4_unicode_ci,
  `fax` text COLLATE utf8mb4_unicode_ci,
  `field_of_study` text COLLATE utf8mb4_unicode_ci,
  `followup` text COLLATE utf8mb4_unicode_ci,
  `hs_longitude` decimal(15,2) DEFAULT NULL,
  `hs_pinned_engagement_id` decimal(15,2) DEFAULT NULL,
  `hs_predictivecontactscore` decimal(15,2) DEFAULT NULL,
  `hs_predictivecontactscore_v2` decimal(15,2) DEFAULT NULL,
  `hs_quarantined_emails` text COLLATE utf8mb4_unicode_ci,
  `hs_recent_closed_order_date` datetime DEFAULT NULL,
  `hs_returning_to_office_detected_date` datetime DEFAULT NULL,
  `hs_searchable_calculated_international_mobile_number` text COLLATE utf8mb4_unicode_ci,
  `hs_searchable_calculated_international_phone_number` text COLLATE utf8mb4_unicode_ci,
  `hs_social_last_engagement` datetime DEFAULT NULL,
  `hs_source_object_id` decimal(15,2) DEFAULT NULL,
  `hs_source_portal_id` decimal(15,2) DEFAULT NULL,
  `hs_time_between_contact_creation_and_deal_close` decimal(15,2) DEFAULT NULL,
  `hs_time_to_move_from_lead_to_customer` decimal(15,2) DEFAULT NULL,
  `hs_time_to_move_from_marketingqualifiedlead_to_customer` decimal(15,2) DEFAULT NULL,
  `hs_time_to_move_from_opportunity_to_customer` decimal(15,2) DEFAULT NULL,
  `hs_time_to_move_from_salesqualifiedlead_to_customer` decimal(15,2) DEFAULT NULL,
  `hs_time_to_move_from_subscriber_to_customer` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_customer` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_evangelist` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_marketingqualifiedlead` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_opportunity` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_other` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_salesqualifiedlead` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_subscriber` decimal(15,2) DEFAULT NULL,
  `hs_v2_date_entered_customer` datetime DEFAULT NULL,
  `hs_v2_date_entered_evangelist` datetime DEFAULT NULL,
  `hs_v2_date_entered_marketingqualifiedlead` datetime DEFAULT NULL,
  `hs_v2_date_entered_opportunity` datetime DEFAULT NULL,
  `hs_v2_date_entered_other` datetime DEFAULT NULL,
  `hs_v2_date_entered_salesqualifiedlead` datetime DEFAULT NULL,
  `hs_v2_date_exited_customer` datetime DEFAULT NULL,
  `hs_v2_date_exited_evangelist` datetime DEFAULT NULL,
  `hs_v2_date_exited_marketingqualifiedlead` datetime DEFAULT NULL,
  `hs_v2_date_exited_opportunity` datetime DEFAULT NULL,
  `hs_v2_date_exited_other` datetime DEFAULT NULL,
  `hs_v2_date_exited_salesqualifiedlead` datetime DEFAULT NULL,
  `hs_v2_date_exited_subscriber` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_customer` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_evangelist` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_marketingqualifiedlead` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_opportunity` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_other` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_salesqualifiedlead` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_subscriber` decimal(15,2) DEFAULT NULL,
  `hubspotscore` decimal(15,2) DEFAULT NULL,
  `msg_summary` text COLLATE utf8mb4_unicode_ci,
  `recent_deal_amount` decimal(15,2) DEFAULT NULL,
  `recent_deal_close_date` datetime DEFAULT NULL,
  `total_revenue` decimal(15,2) DEFAULT NULL,
  `formissue` text COLLATE utf8mb4_unicode_ci,
  `gender` text COLLATE utf8mb4_unicode_ci,
  `google_ads_campaign` text COLLATE utf8mb4_unicode_ci,
  `graduation_date` text COLLATE utf8mb4_unicode_ci,
  `high_value_students` text COLLATE utf8mb4_unicode_ci,
  `hs_analytics_first_touch_converting_campaign` text COLLATE utf8mb4_unicode_ci,
  `hs_analytics_last_touch_converting_campaign` text COLLATE utf8mb4_unicode_ci,
  `hs_avatar_filemanager_key` text COLLATE utf8mb4_unicode_ci,
  `hs_buying_role` text COLLATE utf8mb4_unicode_ci,
  `hs_calculated_phone_number_area_code` text COLLATE utf8mb4_unicode_ci,
  `hs_calculated_phone_number_region_code` text COLLATE utf8mb4_unicode_ci,
  `hs_clicked_linkedin_ad` text COLLATE utf8mb4_unicode_ci,
  `hs_content_membership_email` text COLLATE utf8mb4_unicode_ci,
  `hs_content_membership_status` text COLLATE utf8mb4_unicode_ci,
  `hs_conversations_visitor_email` text COLLATE utf8mb4_unicode_ci,
  `hs_country_region_code` text COLLATE utf8mb4_unicode_ci,
  `hs_ip_timezone` text COLLATE utf8mb4_unicode_ci,
  `hs_timezone` text COLLATE utf8mb4_unicode_ci,
  `ip_city` text COLLATE utf8mb4_unicode_ci,
  `ip_country` text COLLATE utf8mb4_unicode_ci,
  `ip_country_code` text COLLATE utf8mb4_unicode_ci,
  `ip_state` text COLLATE utf8mb4_unicode_ci,
  `ip_state_code` text COLLATE utf8mb4_unicode_ci,
  `spam` text COLLATE utf8mb4_unicode_ci,
  `level` text COLLATE utf8mb4_unicode_ci,
  `hs_email_hard_bounce_reason_enum` text COLLATE utf8mb4_unicode_ci,
  `start_date` text COLLATE utf8mb4_unicode_ci,
  `hs_facebook_click_id` text COLLATE utf8mb4_unicode_ci,
  `hs_email_optout_156423875` tinyint(1) DEFAULT NULL,
  `hs_email_optout_156585599` tinyint(1) DEFAULT NULL,
  `previous_partner_schools_1` text COLLATE utf8mb4_unicode_ci,
  `hs_customer_agent_lead_status` text COLLATE utf8mb4_unicode_ci,
  `hs_email_customer_quarantined_reason` text COLLATE utf8mb4_unicode_ci,
  `hs_email_hard_bounce_reason` text COLLATE utf8mb4_unicode_ci,
  `hs_email_last_email_name` text COLLATE utf8mb4_unicode_ci,
  `hs_email_optimal_send_day_of_week` text COLLATE utf8mb4_unicode_ci,
  `hs_email_optimal_send_time_of_day` text COLLATE utf8mb4_unicode_ci,
  `hs_email_optout_survey_reason` text COLLATE utf8mb4_unicode_ci,
  `hs_email_quarantined_reason` text COLLATE utf8mb4_unicode_ci,
  `hs_emailconfirmationstatus` text COLLATE utf8mb4_unicode_ci,
  `hs_facebookid` text COLLATE utf8mb4_unicode_ci,
  `hs_feedback_last_ces_survey_follow_up` text COLLATE utf8mb4_unicode_ci,
  `hs_feedback_last_csat_survey_follow_up` text COLLATE utf8mb4_unicode_ci,
  `hs_feedback_last_nps_follow_up` text COLLATE utf8mb4_unicode_ci,
  `hs_feedback_last_nps_rating` text COLLATE utf8mb4_unicode_ci,
  `hs_googleplusid` text COLLATE utf8mb4_unicode_ci,
  `hs_gps_error` text COLLATE utf8mb4_unicode_ci,
  `hs_gps_latitude` text COLLATE utf8mb4_unicode_ci,
  `hs_gps_longitude` text COLLATE utf8mb4_unicode_ci,
  `hs_inferred_language_codes` text COLLATE utf8mb4_unicode_ci,
  `hs_journey_stage` text COLLATE utf8mb4_unicode_ci,
  `hs_language` text COLLATE utf8mb4_unicode_ci,
  `hs_last_sms_send_name` text COLLATE utf8mb4_unicode_ci,
  `hs_legal_basis` text COLLATE utf8mb4_unicode_ci,
  `hs_linkedin_ad_clicked` text COLLATE utf8mb4_unicode_ci,
  `hs_linkedin_url` text COLLATE utf8mb4_unicode_ci,
  `hs_linkedinid` text COLLATE utf8mb4_unicode_ci,
  `hs_marketable_reason_id` text COLLATE utf8mb4_unicode_ci,
  `hs_marketable_reason_type` text COLLATE utf8mb4_unicode_ci,
  `hs_mobile_sdk_push_tokens` text COLLATE utf8mb4_unicode_ci,
  `hs_object_source_detail_2` text COLLATE utf8mb4_unicode_ci,
  `hs_object_source_detail_3` text COLLATE utf8mb4_unicode_ci,
  `hs_owning_teams` text COLLATE utf8mb4_unicode_ci,
  `hs_persona` text COLLATE utf8mb4_unicode_ci,
  `hs_predictivecontactscorebucket` text COLLATE utf8mb4_unicode_ci,
  `hs_predictivescoringtier` text COLLATE utf8mb4_unicode_ci,
  `hs_registration_method` text COLLATE utf8mb4_unicode_ci,
  `hs_role` text COLLATE utf8mb4_unicode_ci,
  `hs_seniority` text COLLATE utf8mb4_unicode_ci,
  `hs_shared_team_ids` text COLLATE utf8mb4_unicode_ci,
  `hs_shared_user_ids` text COLLATE utf8mb4_unicode_ci,
  `hs_state_code` text COLLATE utf8mb4_unicode_ci,
  `hs_sub_role` text COLLATE utf8mb4_unicode_ci,
  `hs_testpurge` text COLLATE utf8mb4_unicode_ci,
  `hs_testrollback` text COLLATE utf8mb4_unicode_ci,
  `hs_twitterid` text COLLATE utf8mb4_unicode_ci,
  `hs_unique_creation_key` text COLLATE utf8mb4_unicode_ci,
  `quiz_score` int DEFAULT NULL,
  `adgroup` text COLLATE utf8mb4_unicode_ci,
  `department` text COLLATE utf8mb4_unicode_ci,
  `financial_aid_status` text COLLATE utf8mb4_unicode_ci,
  `hs_contact_enrichment_opt_out` tinyint(1) DEFAULT NULL,
  `hs_contact_enrichment_opt_out_timestamp` datetime DEFAULT NULL,
  `hs_content_membership_follow_up_enqueued_at` datetime DEFAULT NULL,
  `hs_content_membership_notes` text COLLATE utf8mb4_unicode_ci,
  `hs_content_membership_registration_domain_sent_to` text COLLATE utf8mb4_unicode_ci,
  `hs_email_first_click_date` datetime DEFAULT NULL,
  `hs_email_first_open_date` datetime DEFAULT NULL,
  `hs_email_first_reply_date` datetime DEFAULT NULL,
  `hs_email_first_send_date` datetime DEFAULT NULL,
  `hs_email_is_ineligible` tinyint(1) DEFAULT NULL,
  `hs_email_last_click_date` datetime DEFAULT NULL,
  `hs_email_last_open_date` datetime DEFAULT NULL,
  `hs_feedback_last_ces_survey_date` datetime DEFAULT NULL,
  `hs_feedback_last_ces_survey_rating` decimal(15,2) DEFAULT NULL,
  `hs_feedback_last_csat_survey_date` datetime DEFAULT NULL,
  `hs_feedback_last_csat_survey_rating` decimal(15,2) DEFAULT NULL,
  `hs_feedback_last_survey_date` datetime DEFAULT NULL,
  `hs_feedback_show_nps_web_survey` tinyint(1) DEFAULT NULL,
  `hs_first_subscription_create_date` datetime DEFAULT NULL,
  `hs_google_click_id` text COLLATE utf8mb4_unicode_ci,
  `hs_has_active_subscription` decimal(15,2) DEFAULT NULL,
  `hs_job_change_detected_date` datetime DEFAULT NULL,
  `hs_live_enrichment_deadline` datetime DEFAULT NULL,
  `hs_membership_last_private_content_access_date` datetime DEFAULT NULL,
  `hs_prospecting_agent_last_enrolled` datetime DEFAULT NULL,
  `hs_v2_date_entered_subscriber` datetime DEFAULT NULL,
  `hs_v2_date_exited_lead` datetime DEFAULT NULL,
  `jobtitle` text COLLATE utf8mb4_unicode_ci,
  `kloutscoregeneral` decimal(15,2) DEFAULT NULL,
  `linkedinconnections` decimal(15,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hub_contacts_ext`
--

CREATE TABLE `hub_contacts_ext` (
  `hubspot_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hs_intent_signals_enabled` tinyint DEFAULT NULL,
  `hs_intent_paid_up_to_date` datetime DEFAULT NULL,
  `webinareventlastupdated` decimal(15,6) DEFAULT NULL,
  `surveymonkeyeventlastupdated` decimal(15,6) DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `recent_conversion_event_name` text COLLATE utf8mb4_unicode_ci,
  `hs_v2_date_entered_2957649114` datetime DEFAULT NULL,
  `lead_id` text COLLATE utf8mb4_unicode_ci,
  `hs_v2_date_entered_2957588700` datetime DEFAULT NULL,
  `hs_v2_date_entered_2957607129` datetime DEFAULT NULL,
  `hs_v2_cumulative_time_in_2957607129` int DEFAULT NULL,
  `hs_v2_date_exited_2957607129` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_2957607129` int DEFAULT NULL,
  `hs_v2_date_entered_2957391045` datetime DEFAULT NULL,
  `hs_v2_cumulative_time_in_2957649114` int DEFAULT NULL,
  `hs_v2_date_exited_2957649114` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_2957649114` int DEFAULT NULL,
  `hs_v2_cumulative_time_in_2957588700` int DEFAULT NULL,
  `hs_v2_date_exited_2957588700` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_2957588700` int DEFAULT NULL,
  `hs_v2_cumulative_time_in_2957391045` int DEFAULT NULL,
  `hs_v2_date_exited_2957391045` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_2957391045` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `hub_contacts_full`
-- (See below for the actual view)
--
CREATE TABLE `hub_contacts_full` (
`contact_id` int
,`hubspot_id` varchar(50)
,`email` varchar(255)
,`name` text
,`firstname` text
,`lastname` text
,`phone` text
,`country_code` char(2)
,`city` text
,`pipeline_stage` tinyint
,`lifecyclestage` text
,`hs_lead_status` text
,`source` varchar(100)
,`source_detail_1` text
,`source_detail_2` text
,`createdate` datetime
,`lastmodifieddate` datetime
,`created_at` timestamp
,`updated_at` timestamp
,`hs_object_id` int
,`agent` text
,`chattedbefore` text
,`hs_all_accessible_team_ids` text
,`hs_all_contact_vids` bigint
,`hs_all_owner_ids` int
,`hs_all_team_ids` int
,`hs_analytics_average_page_views` int
,`hs_analytics_first_timestamp` datetime
,`hs_analytics_num_event_completions` int
,`hs_analytics_num_page_views` int
,`hs_analytics_num_visits` int
,`hs_analytics_revenue` int
,`hs_analytics_source` text
,`hs_analytics_source_data_1` text
,`hs_analytics_source_data_2` text
,`hs_associated_target_accounts` int
,`hs_count_is_unworked` int
,`hs_count_is_worked` int
,`hs_currently_enrolled_in_prospecting_agent` tinyint(1)
,`hs_email_domain` text
,`hs_first_outreach_date` datetime
,`hs_full_name_or_email` text
,`hs_is_contact` tinyint(1)
,`hs_is_unworked` tinyint(1)
,`hs_latest_source` text
,`hs_latest_source_data_1` text
,`hs_latest_source_data_2` text
,`hs_latest_source_timestamp` datetime
,`hs_marketable_status` tinyint(1)
,`hs_marketable_until_renewal` tinyint(1)
,`hs_membership_has_accessed_private_content` int
,`hs_messaging_engagement_score` decimal(15,6)
,`hs_notes_last_activity` text
,`hs_object_source` text
,`hs_object_source_id` text
,`hs_object_source_label` text
,`hs_pipeline` text
,`hs_prospecting_agent_actively_enrolled_count` int
,`hs_prospecting_agent_total_enrolled_count` int
,`hs_registered_member` int
,`hs_sales_email_last_replied` datetime
,`hs_sequences_actively_enrolled_count` int
,`hs_social_facebook_clicks` int
,`hs_social_google_plus_clicks` int
,`hs_social_linkedin_clicks` int
,`hs_social_num_broadcast_clicks` int
,`hs_social_twitter_clicks` int
,`hs_user_ids_of_all_owners` int
,`hs_v2_date_entered_lead` datetime
,`hubspot_owner_assigneddate` datetime
,`hubspot_owner_id` int
,`hubspot_team_id` int
,`notes_last_updated` datetime
,`num_contacted_notes` int
,`num_conversion_events` int
,`num_notes` int
,`num_unique_conversion_events` int
,`hs_calculated_mobile_number` bigint
,`hs_calculated_phone_number` bigint
,`hs_calculated_phone_number_country_code` text
,`hs_object_source_detail_1` text
,`hs_searchable_calculated_mobile_number` int
,`hs_searchable_calculated_phone_number` int
,`hs_whatsapp_phone_number` bigint
,`mobilephone` bigint
,`hs_first_engagement_object_id` bigint
,`hs_notes_next_activity` text
,`hs_notes_next_activity_type` text
,`hs_sa_first_engagement_date` datetime
,`hs_sa_first_engagement_descr` text
,`hs_sa_first_engagement_object_type` text
,`hs_time_to_first_engagement` int
,`hs_updated_by_user_id` int
,`notes_last_contacted` datetime
,`notes_next_activity_date` datetime
,`first_deal_created_date` datetime
,`hs_all_assigned_business_unit_ids` int
,`hs_created_by_user_id` int
,`hs_last_sales_activity_date` datetime
,`hs_last_sales_activity_timestamp` datetime
,`hs_last_sales_activity_type` text
,`hs_latest_sequence_enrolled` int
,`hs_latest_sequence_enrolled_date` datetime
,`hs_object_source_user_id` int
,`hs_sales_email_last_opened` datetime
,`hs_sequences_enrolled_count` int
,`hs_sequences_is_enrolled` tinyint(1)
,`hs_time_between_contact_creation_and_deal_creation` int
,`nationality` text
,`num_associated_deals` int
,`territory` text
,`course_weeks` int
,`emailed_` text
,`first_conversion_date` datetime
,`first_conversion_event_name` text
,`ga_client_id` decimal(15,6)
,`ga_session_id` text
,`hs_analytics_first_referrer` text
,`hs_analytics_first_url` text
,`hs_analytics_first_visit_timestamp` datetime
,`hs_analytics_last_referrer` text
,`hs_analytics_last_timestamp` datetime
,`hs_analytics_last_url` text
,`hs_analytics_last_visit_timestamp` datetime
,`hs_calculated_form_submissions` text
,`hs_sales_email_last_clicked` datetime
,`recent_conversion_date` datetime
,`gclid` text
,`message_sum_rich` text
,`message_summary` text
,`response` text
,`response_1` text
,`hs_calculated_merged_vids` text
,`hs_latest_sequence_ended_date` datetime
,`hs_latest_sequence_unenrolled_date` datetime
,`hs_merged_object_ids` text
,`hs_v2_cumulative_time_in_lead` int
,`wa_outreach` text
,`question` text
,`hs_created_by_conversations` tinyint(1)
,`date_of_birth` datetime
,`hs_v2_latest_time_in_lead` int
,`state` text
,`zip` text
,`hs_latest_meeting_activity` datetime
,`hs_additional_emails` text
,`address` text
,`associatedcompanyid` bigint
,`country` text
,`academic_program` text
,`address_addon` text
,`age` decimal(15,2)
,`ai_email_closing` text
,`ai_email_head_1` text
,`ai_email_head_2` text
,`associatedcompanylastupdated` decimal(15,2)
,`attendance_record` decimal(15,2)
,`chat_follow` datetime
,`closedate` datetime
,`course_end` datetime
,`course_enrollment_date` datetime
,`course_graduation_date` datetime
,`course_start_date` datetime
,`days_to_close` decimal(15,2)
,`engagements_last_meeting_booked` datetime
,`first_deal` datetime
,`followercount` decimal(15,2)
,`gpa` decimal(15,2)
,`grade` decimal(15,2)
,`hs_content_membership_email_confirmed` tinyint(1)
,`hs_content_membership_registered_at` datetime
,`hs_content_membership_registration_email_sent_at` datetime
,`hs_createdate` datetime
,`hs_cross_sell_opportunity` tinyint(1)
,`hs_data_privacy_ads_consent` tinyint(1)
,`hs_document_last_revisited` datetime
,`hs_email_bad_address` tinyint(1)
,`hs_email_bounce` decimal(15,2)
,`hs_email_click` decimal(15,2)
,`hs_email_delivered` decimal(15,2)
,`hs_email_last_reply_date` datetime
,`hs_email_last_send_date` datetime
,`hs_email_open` decimal(15,2)
,`hs_email_optout` tinyint(1)
,`hs_email_quarantined` tinyint(1)
,`hs_email_recipient_fatigue_recovery_time` datetime
,`hs_email_replied` decimal(15,2)
,`hs_email_sends_since_last_engagement` decimal(15,2)
,`hs_employment_change_detected_date` datetime
,`hs_enriched_email_bounce_detected` tinyint(1)
,`hs_facebook_ad_clicked` tinyint(1)
,`hs_first_closed_order_id` decimal(15,2)
,`hs_first_order_closed_date` datetime
,`hs_is_enriched` tinyint(1)
,`hs_last_metered_enrichment_timestamp` datetime
,`hs_last_sms_send_date` datetime
,`hs_lastmodifieddate` datetime
,`hs_latest_disqualified_lead_date` datetime
,`hs_latest_open_lead_date` datetime
,`hs_latest_qualified_lead_date` datetime
,`hs_latest_sequence_finished_date` datetime
,`hs_latest_subscription_create_date` datetime
,`hs_latitude` decimal(15,2)
,`hs_read_only` tinyint(1)
,`hs_was_imported` tinyint(1)
,`currentlyinworkflow` tinyint(1)
,`ai_email_intro` text
,`ai_email_subject` text
,`annualrevenue` text
,`company` text
,`company_size` text
,`contact_notes` text
,`course_duration` text
,`course_type` text
,`degree` text
,`email_2` text
,`engagements_last_meeting_booked_campaign` text
,`engagements_last_meeting_booked_medium` text
,`engagements_last_meeting_booked_source` text
,`enrollment_status` text
,`existing_customer_` text
,`facebook` text
,`fax` text
,`field_of_study` text
,`followup` text
,`hs_longitude` decimal(15,2)
,`hs_pinned_engagement_id` decimal(15,2)
,`hs_predictivecontactscore` decimal(15,2)
,`hs_predictivecontactscore_v2` decimal(15,2)
,`hs_quarantined_emails` text
,`hs_recent_closed_order_date` datetime
,`hs_returning_to_office_detected_date` datetime
,`hs_searchable_calculated_international_mobile_number` text
,`hs_searchable_calculated_international_phone_number` text
,`hs_social_last_engagement` datetime
,`hs_source_object_id` decimal(15,2)
,`hs_source_portal_id` decimal(15,2)
,`hs_time_between_contact_creation_and_deal_close` decimal(15,2)
,`hs_time_to_move_from_lead_to_customer` decimal(15,2)
,`hs_time_to_move_from_marketingqualifiedlead_to_customer` decimal(15,2)
,`hs_time_to_move_from_opportunity_to_customer` decimal(15,2)
,`hs_time_to_move_from_salesqualifiedlead_to_customer` decimal(15,2)
,`hs_time_to_move_from_subscriber_to_customer` decimal(15,2)
,`hs_v2_cumulative_time_in_customer` decimal(15,2)
,`hs_v2_cumulative_time_in_evangelist` decimal(15,2)
,`hs_v2_cumulative_time_in_marketingqualifiedlead` decimal(15,2)
,`hs_v2_cumulative_time_in_opportunity` decimal(15,2)
,`hs_v2_cumulative_time_in_other` decimal(15,2)
,`hs_v2_cumulative_time_in_salesqualifiedlead` decimal(15,2)
,`hs_v2_cumulative_time_in_subscriber` decimal(15,2)
,`hs_v2_date_entered_customer` datetime
,`hs_v2_date_entered_evangelist` datetime
,`hs_v2_date_entered_marketingqualifiedlead` datetime
,`hs_v2_date_entered_opportunity` datetime
,`hs_v2_date_entered_other` datetime
,`hs_v2_date_entered_salesqualifiedlead` datetime
,`hs_v2_date_exited_customer` datetime
,`hs_v2_date_exited_evangelist` datetime
,`hs_v2_date_exited_marketingqualifiedlead` datetime
,`hs_v2_date_exited_opportunity` datetime
,`hs_v2_date_exited_other` datetime
,`hs_v2_date_exited_salesqualifiedlead` datetime
,`hs_v2_date_exited_subscriber` datetime
,`hs_v2_latest_time_in_customer` decimal(15,2)
,`hs_v2_latest_time_in_evangelist` decimal(15,2)
,`hs_v2_latest_time_in_marketingqualifiedlead` decimal(15,2)
,`hs_v2_latest_time_in_opportunity` decimal(15,2)
,`hs_v2_latest_time_in_other` decimal(15,2)
,`hs_v2_latest_time_in_salesqualifiedlead` decimal(15,2)
,`hs_v2_latest_time_in_subscriber` decimal(15,2)
,`hubspotscore` decimal(15,2)
,`msg_summary` text
,`recent_deal_amount` decimal(15,2)
,`recent_deal_close_date` datetime
,`total_revenue` decimal(15,2)
,`formissue` text
,`gender` text
,`google_ads_campaign` text
,`graduation_date` text
,`high_value_students` text
,`hs_analytics_first_touch_converting_campaign` text
,`hs_analytics_last_touch_converting_campaign` text
,`hs_avatar_filemanager_key` text
,`hs_buying_role` text
,`hs_calculated_phone_number_area_code` text
,`hs_calculated_phone_number_region_code` text
,`hs_clicked_linkedin_ad` text
,`hs_content_membership_email` text
,`hs_content_membership_status` text
,`hs_conversations_visitor_email` text
,`hs_country_region_code` text
,`hs_ip_timezone` text
,`hs_timezone` text
,`ip_city` text
,`ip_country` text
,`ip_country_code` text
,`ip_state` text
,`ip_state_code` text
,`spam` text
,`level` text
,`hs_email_hard_bounce_reason_enum` text
,`start_date` text
,`hs_facebook_click_id` text
,`hs_email_optout_156423875` tinyint(1)
,`hs_email_optout_156585599` tinyint(1)
,`previous_partner_schools_1` text
,`hs_customer_agent_lead_status` text
,`hs_email_customer_quarantined_reason` text
,`hs_email_hard_bounce_reason` text
,`hs_email_last_email_name` text
,`hs_email_optimal_send_day_of_week` text
,`hs_email_optimal_send_time_of_day` text
,`hs_email_optout_survey_reason` text
,`hs_email_quarantined_reason` text
,`hs_emailconfirmationstatus` text
,`hs_facebookid` text
,`hs_feedback_last_ces_survey_follow_up` text
,`hs_feedback_last_csat_survey_follow_up` text
,`hs_feedback_last_nps_follow_up` text
,`hs_feedback_last_nps_rating` text
,`hs_googleplusid` text
,`hs_gps_error` text
,`hs_gps_latitude` text
,`hs_gps_longitude` text
,`hs_inferred_language_codes` text
,`hs_journey_stage` text
,`hs_language` text
,`hs_last_sms_send_name` text
,`hs_legal_basis` text
,`hs_linkedin_ad_clicked` text
,`hs_linkedin_url` text
,`hs_linkedinid` text
,`hs_marketable_reason_id` text
,`hs_marketable_reason_type` text
,`hs_mobile_sdk_push_tokens` text
,`hs_object_source_detail_2` text
,`hs_object_source_detail_3` text
,`hs_owning_teams` text
,`hs_persona` text
,`hs_predictivecontactscorebucket` text
,`hs_predictivescoringtier` text
,`hs_registration_method` text
,`hs_role` text
,`hs_seniority` text
,`hs_shared_team_ids` text
,`hs_shared_user_ids` text
,`hs_state_code` text
,`hs_sub_role` text
,`hs_testpurge` text
,`hs_testrollback` text
,`hs_twitterid` text
,`hs_unique_creation_key` text
,`quiz_score` int
,`adgroup` text
,`department` text
,`financial_aid_status` text
,`hs_contact_enrichment_opt_out` tinyint(1)
,`hs_contact_enrichment_opt_out_timestamp` datetime
,`hs_content_membership_follow_up_enqueued_at` datetime
,`hs_content_membership_notes` text
,`hs_content_membership_registration_domain_sent_to` text
,`hs_email_first_click_date` datetime
,`hs_email_first_open_date` datetime
,`hs_email_first_reply_date` datetime
,`hs_email_first_send_date` datetime
,`hs_email_is_ineligible` tinyint(1)
,`hs_email_last_click_date` datetime
,`hs_email_last_open_date` datetime
,`hs_feedback_last_ces_survey_date` datetime
,`hs_feedback_last_ces_survey_rating` decimal(15,2)
,`hs_feedback_last_csat_survey_date` datetime
,`hs_feedback_last_csat_survey_rating` decimal(15,2)
,`hs_feedback_last_survey_date` datetime
,`hs_feedback_show_nps_web_survey` tinyint(1)
,`hs_first_subscription_create_date` datetime
,`hs_google_click_id` text
,`hs_has_active_subscription` decimal(15,2)
,`hs_job_change_detected_date` datetime
,`hs_live_enrichment_deadline` datetime
,`hs_membership_last_private_content_access_date` datetime
,`hs_prospecting_agent_last_enrolled` datetime
,`hs_v2_date_entered_subscriber` datetime
,`hs_v2_date_exited_lead` datetime
,`jobtitle` text
,`kloutscoregeneral` decimal(15,2)
,`linkedinconnections` decimal(15,2)
,`hs_intent_signals_enabled` tinyint
,`hs_intent_paid_up_to_date` datetime
,`webinareventlastupdated` decimal(15,6)
,`surveymonkeyeventlastupdated` decimal(15,6)
,`message` text
,`ext_created_at` timestamp
,`ext_updated_at` timestamp
);

-- --------------------------------------------------------

--
-- Table structure for table `hub_contact_deal_associations`
--

CREATE TABLE `hub_contact_deal_associations` (
  `association_id` int NOT NULL,
  `contact_hubspot_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deal_hubspot_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `association_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'contact_to_deal',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hub_deals`
--

CREATE TABLE `hub_deals` (
  `deal_id` int NOT NULL,
  `hubspot_deal_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `dealname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `amount_in_home_currency` decimal(12,2) DEFAULT NULL,
  `currency` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'USD',
  `pipeline_stage` tinyint DEFAULT '0',
  `dealstage` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pipeline` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_deal_stage_probability` int DEFAULT NULL,
  `closedate` datetime DEFAULT NULL,
  `deal_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `probability` decimal(5,2) DEFAULT NULL,
  `createdate` datetime DEFAULT NULL,
  `lastmodifieddate` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hs_lastmodifieddate` datetime DEFAULT NULL,
  `hs_object_id` int DEFAULT NULL,
  `days_to_close` int DEFAULT NULL,
  `deal_currency_code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_acv` int DEFAULT NULL,
  `hs_all_accessible_team_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_all_assigned_business_unit_ids` int DEFAULT NULL,
  `hs_all_owner_ids` int DEFAULT NULL,
  `hs_all_team_ids` int DEFAULT NULL,
  `hs_analytics_latest_source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_latest_source_contact` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_latest_source_data_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_latest_source_data_1_contact` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_latest_source_data_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_latest_source_data_2_contact` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_latest_source_timestamp` datetime DEFAULT NULL,
  `hs_analytics_latest_source_timestamp_contact` datetime DEFAULT NULL,
  `hs_analytics_source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_source_data_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_source_data_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_arr` int DEFAULT NULL,
  `hs_attributed_team_ids` int DEFAULT NULL,
  `hs_closed_amount` int DEFAULT NULL,
  `hs_closed_amount_in_home_currency` int DEFAULT NULL,
  `hs_closed_deal_close_date` int DEFAULT NULL,
  `hs_closed_deal_create_date` int DEFAULT NULL,
  `hs_closed_won_count` int DEFAULT NULL,
  `hs_created_by_user_id` int DEFAULT NULL,
  `hs_createdate` datetime DEFAULT NULL,
  `hs_days_to_close_raw` decimal(15,6) DEFAULT NULL,
  `hs_deal_score` int DEFAULT NULL,
  `hs_deal_stage_probability_shadow` decimal(15,6) DEFAULT NULL,
  `hs_duration` bigint DEFAULT NULL,
  `hs_exchange_rate` int DEFAULT NULL,
  `hs_forecast_amount` int DEFAULT NULL,
  `hs_is_closed` tinyint(1) DEFAULT NULL,
  `hs_is_closed_count` int DEFAULT NULL,
  `hs_is_closed_lost` tinyint(1) DEFAULT NULL,
  `hs_is_closed_won` tinyint(1) DEFAULT NULL,
  `hs_is_deal_split` tinyint(1) DEFAULT NULL,
  `hs_is_in_first_deal_stage` tinyint(1) DEFAULT NULL,
  `hs_is_open_count` int DEFAULT NULL,
  `hs_is_stalled` tinyint(1) DEFAULT NULL,
  `hs_latest_sales_email_open_date` datetime DEFAULT NULL,
  `hs_mrr` int DEFAULT NULL,
  `hs_notes_last_activity` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_num_associated_active_deal_registrations` int DEFAULT NULL,
  `hs_num_associated_deal_registrations` int DEFAULT NULL,
  `hs_num_associated_deal_splits` int DEFAULT NULL,
  `hs_num_of_associated_line_items` int DEFAULT NULL,
  `hs_num_target_accounts` int DEFAULT NULL,
  `hs_number_of_call_engagements` int DEFAULT NULL,
  `hs_number_of_inbound_calls` int DEFAULT NULL,
  `hs_number_of_outbound_calls` int DEFAULT NULL,
  `hs_number_of_overdue_tasks` int DEFAULT NULL,
  `hs_object_source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_object_source_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_object_source_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_object_source_user_id` int DEFAULT NULL,
  `hs_open_amount_in_home_currency` int DEFAULT NULL,
  `hs_open_deal_create_date` bigint DEFAULT NULL,
  `hs_projected_amount` decimal(15,6) DEFAULT NULL,
  `hs_projected_amount_in_home_currency` decimal(15,6) DEFAULT NULL,
  `hs_tcv` int DEFAULT NULL,
  `hs_updated_by_user_id` int DEFAULT NULL,
  `hs_user_ids_of_all_owners` int DEFAULT NULL,
  `hs_v2_date_entered_113151423` datetime DEFAULT NULL,
  `hs_v2_date_entered_current_stage` datetime DEFAULT NULL,
  `hs_v2_time_in_current_stage` datetime DEFAULT NULL,
  `hubspot_owner_assigneddate` datetime DEFAULT NULL,
  `hubspot_owner_id` int DEFAULT NULL,
  `hubspot_team_id` int DEFAULT NULL,
  `notes_last_contacted` datetime DEFAULT NULL,
  `notes_last_updated` datetime DEFAULT NULL,
  `num_associated_contacts` int DEFAULT NULL,
  `num_contacted_notes` int DEFAULT NULL,
  `num_notes` int DEFAULT NULL,
  `territory` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_latest_sales_email_click_date` datetime DEFAULT NULL,
  `hs_manual_forecast_category` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_object_source_detail_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_v2_cumulative_time_in_113151423` int DEFAULT NULL,
  `hs_v2_cumulative_time_in_appointmentscheduled` int DEFAULT NULL,
  `hs_v2_date_entered_appointmentscheduled` datetime DEFAULT NULL,
  `hs_v2_date_entered_qualifiedtobuy` datetime DEFAULT NULL,
  `hs_v2_date_exited_113151423` datetime DEFAULT NULL,
  `hs_v2_date_exited_appointmentscheduled` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_113151423` int DEFAULT NULL,
  `hs_v2_latest_time_in_appointmentscheduled` int DEFAULT NULL,
  `createquote` tinyint(1) DEFAULT NULL,
  `deal_product_course` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_latest_sales_email_reply_date` datetime DEFAULT NULL,
  `increment` int DEFAULT NULL,
  `quote_number` int DEFAULT NULL,
  `course_duration` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `course_end` datetime DEFAULT NULL,
  `course_start` datetime DEFAULT NULL,
  `course_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_closed_won_date` datetime DEFAULT NULL,
  `hs_notes_next_activity` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_notes_next_activity_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_sales_email_last_replied` datetime DEFAULT NULL,
  `hs_v2_cumulative_time_in_decisionmakerboughtin` int DEFAULT NULL,
  `hs_v2_date_entered_closedwon` datetime DEFAULT NULL,
  `hs_v2_date_entered_decisionmakerboughtin` datetime DEFAULT NULL,
  `hs_v2_date_exited_decisionmakerboughtin` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_decisionmakerboughtin` int DEFAULT NULL,
  `notes_next_activity_date` datetime DEFAULT NULL,
  `closed_lost_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_v2_date_entered_closedlost` datetime DEFAULT NULL,
  `hs_v2_cumulative_time_in_767120827` int DEFAULT NULL,
  `hs_v2_date_entered_767120827` datetime DEFAULT NULL,
  `hs_v2_date_exited_767120827` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_767120827` int DEFAULT NULL,
  `hs_v2_cumulative_time_in_qualifiedtobuy` int DEFAULT NULL,
  `hs_v2_date_exited_qualifiedtobuy` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_qualifiedtobuy` int DEFAULT NULL,
  `hs_analytics_latest_source_company` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_latest_source_data_1_company` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_latest_source_data_2_company` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_analytics_latest_source_timestamp_company` datetime DEFAULT NULL,
  `hs_primary_associated_company` bigint DEFAULT NULL,
  `hs_v2_date_entered_109570243` datetime DEFAULT NULL,
  `dealtype` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_v2_date_entered_contractsent` datetime DEFAULT NULL,
  `hs_v2_date_entered_109570258` datetime DEFAULT NULL,
  `hs_v2_date_entered_104175586` datetime DEFAULT NULL,
  `hs_v2_cumulative_time_in_109570260` int DEFAULT NULL,
  `hs_v2_date_entered_109570260` datetime DEFAULT NULL,
  `hs_v2_date_entered_109570262` datetime DEFAULT NULL,
  `hs_v2_date_exited_109570260` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_109570260` int DEFAULT NULL,
  `hs_v2_cumulative_time_in_109570257` int DEFAULT NULL,
  `hs_v2_date_entered_109570257` datetime DEFAULT NULL,
  `hs_v2_date_exited_109570257` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_109570257` int DEFAULT NULL,
  `hs_v2_date_entered_104175587` datetime DEFAULT NULL,
  `closed_won_reason` text COLLATE utf8mb4_unicode_ci,
  `contact_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_enrolled_in_sequence` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `engagements_last_meeting_booked` datetime DEFAULT NULL,
  `engagements_last_meeting_booked_campaign` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `engagements_last_meeting_booked_medium` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `engagements_last_meeting_booked_source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `high_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `high_value_students_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_all_collaborator_owner_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_all_deal_split_owner_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_associated_deal_registration_deal_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_associated_deal_registration_product_interests` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_average_call_duration` decimal(15,2) DEFAULT NULL,
  `hs_campaign` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_date_entered_104175584` datetime DEFAULT NULL,
  `hs_date_entered_104175585` datetime DEFAULT NULL,
  `hs_date_entered_104175586` datetime DEFAULT NULL,
  `hs_date_entered_104175587` datetime DEFAULT NULL,
  `hs_date_entered_104175588` datetime DEFAULT NULL,
  `hs_date_entered_104175589` datetime DEFAULT NULL,
  `hs_date_entered_104175590` datetime DEFAULT NULL,
  `hs_date_entered_109570243` datetime DEFAULT NULL,
  `hs_date_entered_109570257` datetime DEFAULT NULL,
  `hs_date_entered_109570258` datetime DEFAULT NULL,
  `hs_date_entered_109570259` datetime DEFAULT NULL,
  `hs_date_entered_109570260` datetime DEFAULT NULL,
  `hs_date_entered_109570261` datetime DEFAULT NULL,
  `hs_date_entered_109570262` datetime DEFAULT NULL,
  `hs_date_entered_109570263` datetime DEFAULT NULL,
  `hs_date_entered_111070952` datetime DEFAULT NULL,
  `hs_date_entered_113151423` datetime DEFAULT NULL,
  `hs_date_entered_114331579` datetime DEFAULT NULL,
  `hs_date_entered_1555217649` datetime DEFAULT NULL,
  `hs_date_entered_767120827` datetime DEFAULT NULL,
  `hs_date_exited_104175584` datetime DEFAULT NULL,
  `hs_date_exited_104175585` datetime DEFAULT NULL,
  `hs_date_exited_104175586` datetime DEFAULT NULL,
  `hs_date_exited_104175587` datetime DEFAULT NULL,
  `hs_date_exited_104175588` datetime DEFAULT NULL,
  `hs_date_exited_104175589` datetime DEFAULT NULL,
  `hs_date_exited_104175590` datetime DEFAULT NULL,
  `hs_date_exited_109570243` datetime DEFAULT NULL,
  `hs_date_exited_109570257` datetime DEFAULT NULL,
  `hs_date_exited_109570258` datetime DEFAULT NULL,
  `hs_date_exited_109570259` datetime DEFAULT NULL,
  `hs_date_exited_109570260` datetime DEFAULT NULL,
  `hs_date_exited_109570261` datetime DEFAULT NULL,
  `hs_date_exited_109570262` datetime DEFAULT NULL,
  `hs_date_exited_109570263` datetime DEFAULT NULL,
  `hs_date_exited_111070952` datetime DEFAULT NULL,
  `hs_date_exited_113151423` datetime DEFAULT NULL,
  `hs_date_exited_114331579` datetime DEFAULT NULL,
  `hs_date_exited_1555217649` datetime DEFAULT NULL,
  `hs_date_exited_767120827` datetime DEFAULT NULL,
  `hs_deal_amount_calculation_preference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_deal_registration_mrr` decimal(15,2) DEFAULT NULL,
  `hs_deal_registration_mrr_currency_code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_forecast_probability` decimal(15,2) DEFAULT NULL,
  `hs_has_empty_conditional_stage_properties` tinyint(1) DEFAULT NULL,
  `hs_is_active_shared_deal` tinyint(1) DEFAULT NULL,
  `hs_is_stalled_after_timestamp` datetime DEFAULT NULL,
  `hs_latest_approval_status` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_latest_approval_status_approval_id` decimal(15,2) DEFAULT NULL,
  `hs_latest_marketing_email_click_date` datetime DEFAULT NULL,
  `hs_latest_marketing_email_open_date` datetime DEFAULT NULL,
  `hs_latest_marketing_email_reply_date` datetime DEFAULT NULL,
  `hs_latest_meeting_activity` datetime DEFAULT NULL,
  `hs_likelihood_to_close` decimal(15,2) DEFAULT NULL,
  `hs_line_item_global_term_hs_discount_percentage` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_line_item_global_term_hs_discount_percentage_enabled` tinyint(1) DEFAULT NULL,
  `hs_line_item_global_term_hs_recurring_billing_period` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_line_item_global_term_hs_recurring_billing_period_enabled` tinyint(1) DEFAULT NULL,
  `hs_line_item_global_term_hs_recurring_billing_start_date` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_line_item_global_term_hs_recurring_billing_start_date_enabled` tinyint(1) DEFAULT NULL,
  `hs_line_item_global_term_recurringbillingfrequency` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_line_item_global_term_recurringbillingfrequency_enabled` tinyint(1) DEFAULT NULL,
  `hs_manual_campaign_ids` decimal(15,2) DEFAULT NULL,
  `hs_merged_object_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_net_pipeline_impact` decimal(15,2) DEFAULT NULL,
  `hs_next_meeting_id` decimal(15,2) DEFAULT NULL,
  `hs_next_meeting_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_next_meeting_start_time` datetime DEFAULT NULL,
  `hs_next_step` text COLLATE utf8mb4_unicode_ci,
  `hs_next_step_updated_at` datetime DEFAULT NULL,
  `hs_number_of_scheduled_meetings` decimal(15,2) DEFAULT NULL,
  `hs_object_source_detail_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_object_source_detail_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_owning_teams` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_pinned_engagement_id` decimal(15,2) DEFAULT NULL,
  `hs_predicted_amount` decimal(15,2) DEFAULT NULL,
  `hs_predicted_amount_in_home_currency` decimal(15,2) DEFAULT NULL,
  `hs_priority` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_read_only` tinyint(1) DEFAULT NULL,
  `hs_shared_team_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_shared_user_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_source_object_id` decimal(15,2) DEFAULT NULL,
  `hs_synced_deal_owner_name_and_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_tag_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_time_in_104175584` decimal(15,2) DEFAULT NULL,
  `hs_time_in_104175585` decimal(15,2) DEFAULT NULL,
  `hs_time_in_104175586` decimal(15,2) DEFAULT NULL,
  `hs_time_in_104175587` decimal(15,2) DEFAULT NULL,
  `hs_time_in_104175588` decimal(15,2) DEFAULT NULL,
  `hs_time_in_104175589` decimal(15,2) DEFAULT NULL,
  `hs_time_in_104175590` decimal(15,2) DEFAULT NULL,
  `hs_time_in_109570243` decimal(15,2) DEFAULT NULL,
  `hs_time_in_109570257` decimal(15,2) DEFAULT NULL,
  `hs_time_in_109570258` decimal(15,2) DEFAULT NULL,
  `hs_time_in_109570259` decimal(15,2) DEFAULT NULL,
  `hs_time_in_109570260` decimal(15,2) DEFAULT NULL,
  `hs_time_in_109570261` decimal(15,2) DEFAULT NULL,
  `hs_time_in_109570262` decimal(15,2) DEFAULT NULL,
  `hs_time_in_109570263` decimal(15,2) DEFAULT NULL,
  `hs_time_in_111070952` decimal(15,2) DEFAULT NULL,
  `hs_time_in_113151423` decimal(15,2) DEFAULT NULL,
  `hs_time_in_114331579` decimal(15,2) DEFAULT NULL,
  `hs_time_in_1555217649` decimal(15,2) DEFAULT NULL,
  `hs_time_in_767120827` decimal(15,2) DEFAULT NULL,
  `hs_unique_creation_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_user_ids_of_all_notification_followers` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hs_v2_cumulative_time_in_104175584` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_104175585` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_104175586` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_104175587` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_104175588` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_104175589` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_104175590` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_109570243` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_109570258` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_109570259` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_109570261` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_109570262` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_109570263` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_111070952` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_114331579` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_1555217649` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_closedlost` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_closedwon` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_contractsent` decimal(15,2) DEFAULT NULL,
  `hs_v2_cumulative_time_in_presentationscheduled` decimal(15,2) DEFAULT NULL,
  `hs_v2_date_entered_104175584` datetime DEFAULT NULL,
  `hs_v2_date_entered_104175585` datetime DEFAULT NULL,
  `hs_v2_date_entered_104175588` datetime DEFAULT NULL,
  `hs_v2_date_entered_104175589` datetime DEFAULT NULL,
  `hs_v2_date_entered_104175590` datetime DEFAULT NULL,
  `hs_v2_date_entered_109570259` datetime DEFAULT NULL,
  `hs_v2_date_entered_109570261` datetime DEFAULT NULL,
  `hs_v2_date_entered_109570263` datetime DEFAULT NULL,
  `hs_v2_date_entered_111070952` datetime DEFAULT NULL,
  `hs_v2_date_entered_114331579` datetime DEFAULT NULL,
  `hs_v2_date_entered_1555217649` datetime DEFAULT NULL,
  `hs_v2_date_entered_presentationscheduled` datetime DEFAULT NULL,
  `hs_v2_date_exited_104175584` datetime DEFAULT NULL,
  `hs_v2_date_exited_104175585` datetime DEFAULT NULL,
  `hs_v2_date_exited_104175586` datetime DEFAULT NULL,
  `hs_v2_date_exited_104175587` datetime DEFAULT NULL,
  `hs_v2_date_exited_104175588` datetime DEFAULT NULL,
  `hs_v2_date_exited_104175589` datetime DEFAULT NULL,
  `hs_v2_date_exited_104175590` datetime DEFAULT NULL,
  `hs_v2_date_exited_109570243` datetime DEFAULT NULL,
  `hs_v2_date_exited_109570258` datetime DEFAULT NULL,
  `hs_v2_date_exited_109570259` datetime DEFAULT NULL,
  `hs_v2_date_exited_109570261` datetime DEFAULT NULL,
  `hs_v2_date_exited_109570262` datetime DEFAULT NULL,
  `hs_v2_date_exited_109570263` datetime DEFAULT NULL,
  `hs_v2_date_exited_111070952` datetime DEFAULT NULL,
  `hs_v2_date_exited_114331579` datetime DEFAULT NULL,
  `hs_v2_date_exited_1555217649` datetime DEFAULT NULL,
  `hs_v2_date_exited_closedlost` datetime DEFAULT NULL,
  `hs_v2_date_exited_closedwon` datetime DEFAULT NULL,
  `hs_v2_date_exited_contractsent` datetime DEFAULT NULL,
  `hs_v2_date_exited_presentationscheduled` datetime DEFAULT NULL,
  `hs_v2_latest_time_in_104175584` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_104175585` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_104175586` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_104175587` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_104175588` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_104175589` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_104175590` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_109570243` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_109570258` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_109570259` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_109570261` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_109570262` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_109570263` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_111070952` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_114331579` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_1555217649` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_closedlost` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_closedwon` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_contractsent` decimal(15,2) DEFAULT NULL,
  `hs_v2_latest_time_in_presentationscheduled` decimal(15,2) DEFAULT NULL,
  `hs_was_imported` tinyint(1) DEFAULT NULL,
  `hs_user_ids_of_all_notification_unfollowers` text COLLATE utf8mb4_unicode_ci,
  `lead_source` text COLLATE utf8mb4_unicode_ci,
  `hs_average_deal_owner_duration_in_current_stage` decimal(15,2) DEFAULT NULL,
  `adjusted_amount` decimal(15,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hub_deals_ext`
--

CREATE TABLE `hub_deals_ext` (
  `hubspot_deal_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hs_actual_duration` int DEFAULT NULL,
  `ecl_sent` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `hub_deals_full`
-- (See below for the actual view)
--
CREATE TABLE `hub_deals_full` (
`deal_id` int
,`hubspot_deal_id` varchar(50)
,`dealname` varchar(255)
,`amount` decimal(10,2)
,`amount_in_home_currency` decimal(12,2)
,`currency` varchar(10)
,`pipeline_stage` tinyint
,`dealstage` varchar(100)
,`pipeline` varchar(100)
,`hs_deal_stage_probability` int
,`closedate` datetime
,`deal_type` varchar(50)
,`source` varchar(100)
,`probability` decimal(5,2)
,`createdate` datetime
,`lastmodifieddate` datetime
,`created_at` timestamp
,`updated_at` timestamp
,`hs_lastmodifieddate` datetime
,`hs_object_id` int
,`days_to_close` int
,`deal_currency_code` varchar(255)
,`hs_acv` int
,`hs_all_accessible_team_ids` varchar(255)
,`hs_all_assigned_business_unit_ids` int
,`hs_all_owner_ids` int
,`hs_all_team_ids` int
,`hs_analytics_latest_source` varchar(255)
,`hs_analytics_latest_source_contact` varchar(255)
,`hs_analytics_latest_source_data_1` varchar(255)
,`hs_analytics_latest_source_data_1_contact` varchar(255)
,`hs_analytics_latest_source_data_2` varchar(255)
,`hs_analytics_latest_source_data_2_contact` varchar(255)
,`hs_analytics_latest_source_timestamp` datetime
,`hs_analytics_latest_source_timestamp_contact` datetime
,`hs_analytics_source` varchar(255)
,`hs_analytics_source_data_1` varchar(255)
,`hs_analytics_source_data_2` varchar(255)
,`hs_arr` int
,`hs_attributed_team_ids` int
,`hs_closed_amount` int
,`hs_closed_amount_in_home_currency` int
,`hs_closed_deal_close_date` int
,`hs_closed_deal_create_date` int
,`hs_closed_won_count` int
,`hs_created_by_user_id` int
,`hs_createdate` datetime
,`hs_days_to_close_raw` decimal(15,6)
,`hs_deal_score` int
,`hs_deal_stage_probability_shadow` decimal(15,6)
,`hs_duration` bigint
,`hs_exchange_rate` int
,`hs_forecast_amount` int
,`hs_is_closed` tinyint(1)
,`hs_is_closed_count` int
,`hs_is_closed_lost` tinyint(1)
,`hs_is_closed_won` tinyint(1)
,`hs_is_deal_split` tinyint(1)
,`hs_is_in_first_deal_stage` tinyint(1)
,`hs_is_open_count` int
,`hs_is_stalled` tinyint(1)
,`hs_latest_sales_email_open_date` datetime
,`hs_mrr` int
,`hs_notes_last_activity` varchar(255)
,`hs_num_associated_active_deal_registrations` int
,`hs_num_associated_deal_registrations` int
,`hs_num_associated_deal_splits` int
,`hs_num_of_associated_line_items` int
,`hs_num_target_accounts` int
,`hs_number_of_call_engagements` int
,`hs_number_of_inbound_calls` int
,`hs_number_of_outbound_calls` int
,`hs_number_of_overdue_tasks` int
,`hs_object_source` varchar(255)
,`hs_object_source_id` varchar(255)
,`hs_object_source_label` varchar(255)
,`hs_object_source_user_id` int
,`hs_open_amount_in_home_currency` int
,`hs_open_deal_create_date` bigint
,`hs_projected_amount` decimal(15,6)
,`hs_projected_amount_in_home_currency` decimal(15,6)
,`hs_tcv` int
,`hs_updated_by_user_id` int
,`hs_user_ids_of_all_owners` int
,`hs_v2_date_entered_113151423` datetime
,`hs_v2_date_entered_current_stage` datetime
,`hs_v2_time_in_current_stage` datetime
,`hubspot_owner_assigneddate` datetime
,`hubspot_owner_id` int
,`hubspot_team_id` int
,`notes_last_contacted` datetime
,`notes_last_updated` datetime
,`num_associated_contacts` int
,`num_contacted_notes` int
,`num_notes` int
,`territory` varchar(255)
,`hs_latest_sales_email_click_date` datetime
,`hs_manual_forecast_category` varchar(255)
,`hs_object_source_detail_1` varchar(255)
,`hs_v2_cumulative_time_in_113151423` int
,`hs_v2_cumulative_time_in_appointmentscheduled` int
,`hs_v2_date_entered_appointmentscheduled` datetime
,`hs_v2_date_entered_qualifiedtobuy` datetime
,`hs_v2_date_exited_113151423` datetime
,`hs_v2_date_exited_appointmentscheduled` datetime
,`hs_v2_latest_time_in_113151423` int
,`hs_v2_latest_time_in_appointmentscheduled` int
,`createquote` tinyint(1)
,`deal_product_course` varchar(255)
,`description` varchar(255)
,`hs_latest_sales_email_reply_date` datetime
,`increment` int
,`quote_number` int
,`course_duration` varchar(255)
,`course_end` datetime
,`course_start` datetime
,`course_type` varchar(255)
,`hs_closed_won_date` datetime
,`hs_notes_next_activity` varchar(255)
,`hs_notes_next_activity_type` varchar(255)
,`hs_sales_email_last_replied` datetime
,`hs_v2_cumulative_time_in_decisionmakerboughtin` int
,`hs_v2_date_entered_closedwon` datetime
,`hs_v2_date_entered_decisionmakerboughtin` datetime
,`hs_v2_date_exited_decisionmakerboughtin` datetime
,`hs_v2_latest_time_in_decisionmakerboughtin` int
,`notes_next_activity_date` datetime
,`closed_lost_reason` varchar(255)
,`hs_v2_date_entered_closedlost` datetime
,`hs_v2_cumulative_time_in_767120827` int
,`hs_v2_date_entered_767120827` datetime
,`hs_v2_date_exited_767120827` datetime
,`hs_v2_latest_time_in_767120827` int
,`hs_v2_cumulative_time_in_qualifiedtobuy` int
,`hs_v2_date_exited_qualifiedtobuy` datetime
,`hs_v2_latest_time_in_qualifiedtobuy` int
,`hs_analytics_latest_source_company` varchar(255)
,`hs_analytics_latest_source_data_1_company` varchar(255)
,`hs_analytics_latest_source_data_2_company` varchar(255)
,`hs_analytics_latest_source_timestamp_company` datetime
,`hs_primary_associated_company` bigint
,`hs_v2_date_entered_109570243` datetime
,`dealtype` varchar(255)
,`hs_v2_date_entered_contractsent` datetime
,`hs_v2_date_entered_109570258` datetime
,`hs_v2_date_entered_104175586` datetime
,`hs_v2_cumulative_time_in_109570260` int
,`hs_v2_date_entered_109570260` datetime
,`hs_v2_date_entered_109570262` datetime
,`hs_v2_date_exited_109570260` datetime
,`hs_v2_latest_time_in_109570260` int
,`hs_v2_cumulative_time_in_109570257` int
,`hs_v2_date_entered_109570257` datetime
,`hs_v2_date_exited_109570257` datetime
,`hs_v2_latest_time_in_109570257` int
,`hs_v2_date_entered_104175587` datetime
,`closed_won_reason` text
,`contact_email` varchar(255)
,`contact_enrolled_in_sequence` varchar(255)
,`engagements_last_meeting_booked` datetime
,`engagements_last_meeting_booked_campaign` varchar(255)
,`engagements_last_meeting_booked_medium` varchar(255)
,`engagements_last_meeting_booked_source` varchar(255)
,`high_value` varchar(255)
,`high_value_students_2` varchar(255)
,`hs_all_collaborator_owner_ids` varchar(255)
,`hs_all_deal_split_owner_ids` varchar(255)
,`hs_associated_deal_registration_deal_type` varchar(255)
,`hs_associated_deal_registration_product_interests` varchar(255)
,`hs_average_call_duration` decimal(15,2)
,`hs_campaign` varchar(255)
,`hs_date_entered_104175584` datetime
,`hs_date_entered_104175585` datetime
,`hs_date_entered_104175586` datetime
,`hs_date_entered_104175587` datetime
,`hs_date_entered_104175588` datetime
,`hs_date_entered_104175589` datetime
,`hs_date_entered_104175590` datetime
,`hs_date_entered_109570243` datetime
,`hs_date_entered_109570257` datetime
,`hs_date_entered_109570258` datetime
,`hs_date_entered_109570259` datetime
,`hs_date_entered_109570260` datetime
,`hs_date_entered_109570261` datetime
,`hs_date_entered_109570262` datetime
,`hs_date_entered_109570263` datetime
,`hs_date_entered_111070952` datetime
,`hs_date_entered_113151423` datetime
,`hs_date_entered_114331579` datetime
,`hs_date_entered_1555217649` datetime
,`hs_date_entered_767120827` datetime
,`hs_date_exited_104175584` datetime
,`hs_date_exited_104175585` datetime
,`hs_date_exited_104175586` datetime
,`hs_date_exited_104175587` datetime
,`hs_date_exited_104175588` datetime
,`hs_date_exited_104175589` datetime
,`hs_date_exited_104175590` datetime
,`hs_date_exited_109570243` datetime
,`hs_date_exited_109570257` datetime
,`hs_date_exited_109570258` datetime
,`hs_date_exited_109570259` datetime
,`hs_date_exited_109570260` datetime
,`hs_date_exited_109570261` datetime
,`hs_date_exited_109570262` datetime
,`hs_date_exited_109570263` datetime
,`hs_date_exited_111070952` datetime
,`hs_date_exited_113151423` datetime
,`hs_date_exited_114331579` datetime
,`hs_date_exited_1555217649` datetime
,`hs_date_exited_767120827` datetime
,`hs_deal_amount_calculation_preference` varchar(255)
,`hs_deal_registration_mrr` decimal(15,2)
,`hs_deal_registration_mrr_currency_code` varchar(255)
,`hs_forecast_probability` decimal(15,2)
,`hs_has_empty_conditional_stage_properties` tinyint(1)
,`hs_is_active_shared_deal` tinyint(1)
,`hs_is_stalled_after_timestamp` datetime
,`hs_latest_approval_status` varchar(255)
,`hs_latest_approval_status_approval_id` decimal(15,2)
,`hs_latest_marketing_email_click_date` datetime
,`hs_latest_marketing_email_open_date` datetime
,`hs_latest_marketing_email_reply_date` datetime
,`hs_latest_meeting_activity` datetime
,`hs_likelihood_to_close` decimal(15,2)
,`hs_line_item_global_term_hs_discount_percentage` varchar(255)
,`hs_line_item_global_term_hs_discount_percentage_enabled` tinyint(1)
,`hs_line_item_global_term_hs_recurring_billing_period` varchar(255)
,`hs_line_item_global_term_hs_recurring_billing_period_enabled` tinyint(1)
,`hs_line_item_global_term_hs_recurring_billing_start_date` varchar(255)
,`hs_line_item_global_term_hs_recurring_billing_start_date_enabled` tinyint(1)
,`hs_line_item_global_term_recurringbillingfrequency` varchar(255)
,`hs_line_item_global_term_recurringbillingfrequency_enabled` tinyint(1)
,`hs_manual_campaign_ids` decimal(15,2)
,`hs_merged_object_ids` varchar(255)
,`hs_net_pipeline_impact` decimal(15,2)
,`hs_next_meeting_id` decimal(15,2)
,`hs_next_meeting_name` varchar(255)
,`hs_next_meeting_start_time` datetime
,`hs_next_step` text
,`hs_next_step_updated_at` datetime
,`hs_number_of_scheduled_meetings` decimal(15,2)
,`hs_object_source_detail_2` varchar(255)
,`hs_object_source_detail_3` varchar(255)
,`hs_owning_teams` varchar(255)
,`hs_pinned_engagement_id` decimal(15,2)
,`hs_predicted_amount` decimal(15,2)
,`hs_predicted_amount_in_home_currency` decimal(15,2)
,`hs_priority` varchar(255)
,`hs_read_only` tinyint(1)
,`hs_shared_team_ids` varchar(255)
,`hs_shared_user_ids` varchar(255)
,`hs_source_object_id` decimal(15,2)
,`hs_synced_deal_owner_name_and_email` varchar(255)
,`hs_tag_ids` varchar(255)
,`hs_time_in_104175584` decimal(15,2)
,`hs_time_in_104175585` decimal(15,2)
,`hs_time_in_104175586` decimal(15,2)
,`hs_time_in_104175587` decimal(15,2)
,`hs_time_in_104175588` decimal(15,2)
,`hs_time_in_104175589` decimal(15,2)
,`hs_time_in_104175590` decimal(15,2)
,`hs_time_in_109570243` decimal(15,2)
,`hs_time_in_109570257` decimal(15,2)
,`hs_time_in_109570258` decimal(15,2)
,`hs_time_in_109570259` decimal(15,2)
,`hs_time_in_109570260` decimal(15,2)
,`hs_time_in_109570261` decimal(15,2)
,`hs_time_in_109570262` decimal(15,2)
,`hs_time_in_109570263` decimal(15,2)
,`hs_time_in_111070952` decimal(15,2)
,`hs_time_in_113151423` decimal(15,2)
,`hs_time_in_114331579` decimal(15,2)
,`hs_time_in_1555217649` decimal(15,2)
,`hs_time_in_767120827` decimal(15,2)
,`hs_unique_creation_key` varchar(255)
,`hs_user_ids_of_all_notification_followers` varchar(255)
,`hs_v2_cumulative_time_in_104175584` decimal(15,2)
,`hs_v2_cumulative_time_in_104175585` decimal(15,2)
,`hs_v2_cumulative_time_in_104175586` decimal(15,2)
,`hs_v2_cumulative_time_in_104175587` decimal(15,2)
,`hs_v2_cumulative_time_in_104175588` decimal(15,2)
,`hs_v2_cumulative_time_in_104175589` decimal(15,2)
,`hs_v2_cumulative_time_in_104175590` decimal(15,2)
,`hs_v2_cumulative_time_in_109570243` decimal(15,2)
,`hs_v2_cumulative_time_in_109570258` decimal(15,2)
,`hs_v2_cumulative_time_in_109570259` decimal(15,2)
,`hs_v2_cumulative_time_in_109570261` decimal(15,2)
,`hs_v2_cumulative_time_in_109570262` decimal(15,2)
,`hs_v2_cumulative_time_in_109570263` decimal(15,2)
,`hs_v2_cumulative_time_in_111070952` decimal(15,2)
,`hs_v2_cumulative_time_in_114331579` decimal(15,2)
,`hs_v2_cumulative_time_in_1555217649` decimal(15,2)
,`hs_v2_cumulative_time_in_closedlost` decimal(15,2)
,`hs_v2_cumulative_time_in_closedwon` decimal(15,2)
,`hs_v2_cumulative_time_in_contractsent` decimal(15,2)
,`hs_v2_cumulative_time_in_presentationscheduled` decimal(15,2)
,`hs_v2_date_entered_104175584` datetime
,`hs_v2_date_entered_104175585` datetime
,`hs_v2_date_entered_104175588` datetime
,`hs_v2_date_entered_104175589` datetime
,`hs_v2_date_entered_104175590` datetime
,`hs_v2_date_entered_109570259` datetime
,`hs_v2_date_entered_109570261` datetime
,`hs_v2_date_entered_109570263` datetime
,`hs_v2_date_entered_111070952` datetime
,`hs_v2_date_entered_114331579` datetime
,`hs_v2_date_entered_1555217649` datetime
,`hs_v2_date_entered_presentationscheduled` datetime
,`hs_v2_date_exited_104175584` datetime
,`hs_v2_date_exited_104175585` datetime
,`hs_v2_date_exited_104175586` datetime
,`hs_v2_date_exited_104175587` datetime
,`hs_v2_date_exited_104175588` datetime
,`hs_v2_date_exited_104175589` datetime
,`hs_v2_date_exited_104175590` datetime
,`hs_v2_date_exited_109570243` datetime
,`hs_v2_date_exited_109570258` datetime
,`hs_v2_date_exited_109570259` datetime
,`hs_v2_date_exited_109570261` datetime
,`hs_v2_date_exited_109570262` datetime
,`hs_v2_date_exited_109570263` datetime
,`hs_v2_date_exited_111070952` datetime
,`hs_v2_date_exited_114331579` datetime
,`hs_v2_date_exited_1555217649` datetime
,`hs_v2_date_exited_closedlost` datetime
,`hs_v2_date_exited_closedwon` datetime
,`hs_v2_date_exited_contractsent` datetime
,`hs_v2_date_exited_presentationscheduled` datetime
,`hs_v2_latest_time_in_104175584` decimal(15,2)
,`hs_v2_latest_time_in_104175585` decimal(15,2)
,`hs_v2_latest_time_in_104175586` decimal(15,2)
,`hs_v2_latest_time_in_104175587` decimal(15,2)
,`hs_v2_latest_time_in_104175588` decimal(15,2)
,`hs_v2_latest_time_in_104175589` decimal(15,2)
,`hs_v2_latest_time_in_104175590` decimal(15,2)
,`hs_v2_latest_time_in_109570243` decimal(15,2)
,`hs_v2_latest_time_in_109570258` decimal(15,2)
,`hs_v2_latest_time_in_109570259` decimal(15,2)
,`hs_v2_latest_time_in_109570261` decimal(15,2)
,`hs_v2_latest_time_in_109570262` decimal(15,2)
,`hs_v2_latest_time_in_109570263` decimal(15,2)
,`hs_v2_latest_time_in_111070952` decimal(15,2)
,`hs_v2_latest_time_in_114331579` decimal(15,2)
,`hs_v2_latest_time_in_1555217649` decimal(15,2)
,`hs_v2_latest_time_in_closedlost` decimal(15,2)
,`hs_v2_latest_time_in_closedwon` decimal(15,2)
,`hs_v2_latest_time_in_contractsent` decimal(15,2)
,`hs_v2_latest_time_in_presentationscheduled` decimal(15,2)
,`hs_was_imported` tinyint(1)
,`hs_user_ids_of_all_notification_unfollowers` text
,`lead_source` text
,`hs_average_deal_owner_duration_in_current_stage` decimal(15,2)
,`adjusted_amount` decimal(15,2)
,`ext_created_at` timestamp
,`ext_updated_at` timestamp
);

-- --------------------------------------------------------

--
-- Table structure for table `hub_sync_log`
--

CREATE TABLE `hub_sync_log` (
  `sync_id` int NOT NULL,
  `sync_type` enum('contacts','deals','full') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `records_synced` int DEFAULT '0',
  `status` enum('running','completed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'running',
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `lead_territory_summary`
--

CREATE ALGORITHM=UNDEFINED DEFINER=`hub`@`localhost` SQL SECURITY DEFINER VIEW `lead_territory_summary`  AS SELECT `cr`.`status` AS `territory_status`, `cr`.`country_name` AS `country_name`, `cr`.`country_code` AS `country_code`, count(`hl`.`lead_id`) AS `lead_count`, `ps`.`stage_name` AS `stage_name`, `ps`.`stage_weight` AS `stage_weight` FROM ((`country_rules` `cr` left join `hub_leads` `hl` on((`cr`.`country_code` = `hl`.`country_code`))) left join `pipeline_stages` `ps` on((`hl`.`pipeline_stage` = `ps`.`stage_id`))) GROUP BY `cr`.`country_code`, `cr`.`status`, `cr`.`country_name`, `ps`.`stage_name`, `ps`.`stage_weight` ORDER BY `cr`.`status` ASC, `lead_count` DESC ;

-- --------------------------------------------------------

--
-- Table structure for table `pipeline_stages`
--

CREATE TABLE `pipeline_stages` (
  `stage_id` tinyint NOT NULL,
  `stage_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stage_weight` tinyint NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_terminal` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `campaign_geo_targeting`
--
ALTER TABLE `campaign_geo_targeting`
  ADD PRIMARY KEY (`targeting_id`),
  ADD KEY `country_code` (`country_code`),
  ADD KEY `idx_campaign_country` (`campaign_name`,`country_code`);

--
-- Indexes for table `country_rules`
--
ALTER TABLE `country_rules`
  ADD PRIMARY KEY (`country_code`);

--
-- Indexes for table `ecl_logs`
--
ALTER TABLE `ecl_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_deal_id` (`deal_id`),
  ADD KEY `idx_contact_id` (`contact_id`),
  ADD KEY `idx_gclid` (`gclid`),
  ADD KEY `idx_stage` (`stage`),
  ADD KEY `idx_mql_rejection` (`is_mql_rejection`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `gads_campaigns`
--
ALTER TABLE `gads_campaigns`
  ADD PRIMARY KEY (`campaign_id`),
  ADD UNIQUE KEY `uk_google_campaign_id` (`google_campaign_id`),
  ADD KEY `idx_campaign_type` (`campaign_type`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_budget` (`daily_budget_eur`),
  ADD KEY `idx_name` (`campaign_name`(50));

--
-- Indexes for table `gads_campaign_metrics`
--
ALTER TABLE `gads_campaign_metrics`
  ADD PRIMARY KEY (`metric_id`),
  ADD UNIQUE KEY `uk_campaign_date` (`google_campaign_id`,`date`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_cost` (`cost_eur`),
  ADD KEY `idx_date_cost` (`date`,`cost_eur`),
  ADD KEY `idx_conversions` (`conversions`);

--
-- Indexes for table `gads_campaign_status_history`
--
ALTER TABLE `gads_campaign_status_history`
  ADD PRIMARY KEY (`history_id`),
  ADD KEY `idx_campaign_status` (`google_campaign_id`,`status_changed_at`),
  ADD KEY `idx_status_change` (`new_status`,`status_changed_at`),
  ADD KEY `idx_sync_id` (`sync_id`);

--
-- Indexes for table `gads_geo_targeting`
--
ALTER TABLE `gads_geo_targeting`
  ADD PRIMARY KEY (`targeting_id`),
  ADD KEY `idx_campaign_geo` (`google_campaign_id`,`country_code`),
  ADD KEY `idx_negative` (`is_negative`);

--
-- Indexes for table `gads_keywords`
--
ALTER TABLE `gads_keywords`
  ADD PRIMARY KEY (`keyword_id`),
  ADD KEY `idx_campaign_keyword` (`google_campaign_id`,`keyword_text`),
  ADD KEY `idx_match_type` (`match_type`);

--
-- Indexes for table `gads_keyword_metrics`
--
ALTER TABLE `gads_keyword_metrics`
  ADD PRIMARY KEY (`metric_id`),
  ADD UNIQUE KEY `uk_keyword_date` (`keyword_id`,`date`),
  ADD KEY `idx_date` (`date`);

--
-- Indexes for table `gads_sync_log`
--
ALTER TABLE `gads_sync_log`
  ADD PRIMARY KEY (`sync_id`),
  ADD KEY `idx_sync_type_date` (`sync_type`,`start_date`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `geo_targets`
--
ALTER TABLE `geo_targets`
  ADD PRIMARY KEY (`geo_id`),
  ADD KEY `idx_country_gdp` (`country_code`,`gdp_score`),
  ADD KEY `idx_active_targets` (`active`,`gdp_score`);

--
-- Indexes for table `hub_companies`
--
ALTER TABLE `hub_companies`
  ADD PRIMARY KEY (`company_id`),
  ADD UNIQUE KEY `uk_hubspot_company_id` (`hubspot_company_id`),
  ADD KEY `idx_hubspot_company_id` (`hubspot_company_id`),
  ADD KEY `idx_domain` (`domain`),
  ADD KEY `idx_country` (`country`),
  ADD KEY `idx_createdate` (`createdate`);

--
-- Indexes for table `hub_contacts`
--
ALTER TABLE `hub_contacts`
  ADD PRIMARY KEY (`contact_id`),
  ADD UNIQUE KEY `hubspot_id` (`hubspot_id`),
  ADD KEY `email` (`email`),
  ADD KEY `country_code` (`country_code`),
  ADD KEY `pipeline_stage` (`pipeline_stage`),
  ADD KEY `source` (`source`),
  ADD KEY `idx_country_stage` (`country_code`,`pipeline_stage`),
  ADD KEY `idx_createdate` (`createdate`);

--
-- Indexes for table `hub_contacts_ext`
--
ALTER TABLE `hub_contacts_ext`
  ADD PRIMARY KEY (`hubspot_id`);

--
-- Indexes for table `hub_contact_deal_associations`
--
ALTER TABLE `hub_contact_deal_associations`
  ADD PRIMARY KEY (`association_id`),
  ADD UNIQUE KEY `unique_contact_deal` (`contact_hubspot_id`,`deal_hubspot_id`),
  ADD KEY `deal_hubspot_id` (`deal_hubspot_id`);

--
-- Indexes for table `hub_deals`
--
ALTER TABLE `hub_deals`
  ADD PRIMARY KEY (`deal_id`),
  ADD UNIQUE KEY `hubspot_deal_id` (`hubspot_deal_id`),
  ADD KEY `pipeline_stage` (`pipeline_stage`),
  ADD KEY `source` (`source`),
  ADD KEY `idx_created_date` (`createdate`),
  ADD KEY `idx_close_date` (`closedate`);

--
-- Indexes for table `hub_deals_ext`
--
ALTER TABLE `hub_deals_ext`
  ADD PRIMARY KEY (`hubspot_deal_id`);

--
-- Indexes for table `hub_sync_log`
--
ALTER TABLE `hub_sync_log`
  ADD PRIMARY KEY (`sync_id`),
  ADD KEY `idx_sync_dates` (`start_date`,`end_date`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `pipeline_stages`
--
ALTER TABLE `pipeline_stages`
  ADD PRIMARY KEY (`stage_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `campaign_geo_targeting`
--
ALTER TABLE `campaign_geo_targeting`
  MODIFY `targeting_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ecl_logs`
--
ALTER TABLE `ecl_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gads_campaigns`
--
ALTER TABLE `gads_campaigns`
  MODIFY `campaign_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gads_campaign_metrics`
--
ALTER TABLE `gads_campaign_metrics`
  MODIFY `metric_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gads_campaign_status_history`
--
ALTER TABLE `gads_campaign_status_history`
  MODIFY `history_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gads_geo_targeting`
--
ALTER TABLE `gads_geo_targeting`
  MODIFY `targeting_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gads_keywords`
--
ALTER TABLE `gads_keywords`
  MODIFY `keyword_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gads_keyword_metrics`
--
ALTER TABLE `gads_keyword_metrics`
  MODIFY `metric_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gads_sync_log`
--
ALTER TABLE `gads_sync_log`
  MODIFY `sync_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `geo_targets`
--
ALTER TABLE `geo_targets`
  MODIFY `geo_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `hub_companies`
--
ALTER TABLE `hub_companies`
  MODIFY `company_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `hub_contacts`
--
ALTER TABLE `hub_contacts`
  MODIFY `contact_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `hub_contact_deal_associations`
--
ALTER TABLE `hub_contact_deal_associations`
  MODIFY `association_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `hub_deals`
--
ALTER TABLE `hub_deals`
  MODIFY `deal_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `hub_sync_log`
--
ALTER TABLE `hub_sync_log`
  MODIFY `sync_id` int NOT NULL AUTO_INCREMENT;

-- --------------------------------------------------------

--
-- Structure for view `campaign_targeting_summary`
--
DROP TABLE IF EXISTS `campaign_targeting_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`hub`@`localhost` SQL SECURITY DEFINER VIEW `campaign_targeting_summary`  AS SELECT `ct`.`campaign_name` AS `campaign_name`, `ct`.`language` AS `language`, group_concat(distinct concat(`cr`.`country_name`,' (',`ct`.`country_code`,')') separator ', ') AS `target_countries`, count(distinct `ct`.`country_code`) AS `country_count`, avg(`ct`.`gdp_threshold`) AS `avg_gdp_threshold` FROM (`campaign_geo_targeting` `ct` join `country_rules` `cr` on((`ct`.`country_code` = `cr`.`country_code`))) WHERE (`ct`.`active` = true) GROUP BY `ct`.`campaign_name`, `ct`.`language` ORDER BY `ct`.`campaign_name` ASC ;

-- --------------------------------------------------------

--
-- Structure for view `gads_campaign_lifecycle`
--
DROP TABLE IF EXISTS `gads_campaign_lifecycle`;

CREATE ALGORITHM=UNDEFINED DEFINER=`hub`@`localhost` SQL SECURITY DEFINER VIEW `gads_campaign_lifecycle`  AS SELECT `c`.`google_campaign_id` AS `google_campaign_id`, `c`.`campaign_name` AS `campaign_name`, `c`.`campaign_type_name` AS `campaign_type_name`, `c`.`status` AS `current_status`, `c`.`start_date` AS `start_date`, `c`.`end_date` AS `end_date`, min(`h`.`status_changed_at`) AS `first_tracked_date`, max((case when (`h`.`new_status` = 2) then `h`.`status_changed_at` end)) AS `last_activated_date`, max((case when (`h`.`new_status` = 3) then `h`.`status_changed_at` end)) AS `last_paused_date`, count(`h`.`history_id`) AS `total_status_changes`, (to_days(curdate()) - to_days(max(`h`.`status_changed_at`))) AS `days_since_last_change`, (case when ((`c`.`status` = 2) and (max((case when (`h`.`new_status` = 2) then `h`.`status_changed_at` end)) is not null)) then (to_days(curdate()) - to_days(max((case when (`h`.`new_status` = 2) then `h`.`status_changed_at` end)))) when ((`c`.`status` = 3) and (max((case when (`h`.`new_status` = 3) then `h`.`status_changed_at` end)) is not null)) then (to_days(curdate()) - to_days(max((case when (`h`.`new_status` = 3) then `h`.`status_changed_at` end)))) else NULL end) AS `days_in_current_status` FROM (`gads_campaigns` `c` left join `gads_campaign_status_history` `h` on((`c`.`google_campaign_id` = `h`.`google_campaign_id`))) GROUP BY `c`.`google_campaign_id`, `c`.`campaign_name`, `c`.`campaign_type_name`, `c`.`status`, `c`.`start_date`, `c`.`end_date` ORDER BY `c`.`campaign_name` ASC ;

-- --------------------------------------------------------

--
-- Structure for view `gads_campaign_summary_30d`
--
DROP TABLE IF EXISTS `gads_campaign_summary_30d`;

CREATE ALGORITHM=UNDEFINED DEFINER=`hub`@`localhost` SQL SECURITY DEFINER VIEW `gads_campaign_summary_30d`  AS SELECT `c`.`google_campaign_id` AS `google_campaign_id`, `c`.`campaign_name` AS `campaign_name`, `c`.`campaign_type_name` AS `campaign_type_name`, `c`.`status` AS `status`, `c`.`daily_budget_eur` AS `daily_budget_eur`, count(`m`.`date`) AS `days_with_data`, sum(`m`.`impressions`) AS `total_impressions`, sum(`m`.`clicks`) AS `total_clicks`, sum(`m`.`cost_eur`) AS `total_cost`, sum(`m`.`conversions`) AS `total_conversions`, avg(`m`.`ctr`) AS `avg_ctr`, avg(`m`.`cpc_eur`) AS `avg_cpc`, avg(`m`.`conversion_rate`) AS `avg_conversion_rate`, max(`m`.`date`) AS `last_activity_date` FROM (`gads_campaigns` `c` left join `gads_campaign_metrics` `m` on(((`c`.`google_campaign_id` = `m`.`google_campaign_id`) and (`m`.`date` >= (curdate() - interval 30 day))))) GROUP BY `c`.`google_campaign_id`, `c`.`campaign_name`, `c`.`campaign_type_name`, `c`.`status`, `c`.`daily_budget_eur` ORDER BY `total_cost` DESC ;

-- --------------------------------------------------------

--
-- Structure for view `gads_pipeline_summary`
--
DROP TABLE IF EXISTS `gads_pipeline_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`hub`@`localhost` SQL SECURITY DEFINER VIEW `gads_pipeline_summary`  AS SELECT cast(`m`.`date` as date) AS `report_date`, sum(`m`.`impressions`) AS `total_impressions`, sum(`m`.`clicks`) AS `total_clicks`, sum(`m`.`cost_eur`) AS `total_cost`, sum(`m`.`conversions`) AS `total_conversions`, count(distinct `c`.`google_campaign_id`) AS `active_campaigns`, avg(`m`.`ctr`) AS `avg_ctr` FROM (`gads_campaign_metrics` `m` join `gads_campaigns` `c` on((`m`.`google_campaign_id` = `c`.`google_campaign_id`))) WHERE ((`m`.`date` >= (curdate() - interval 90 day)) AND (`c`.`status` = 2)) GROUP BY cast(`m`.`date` as date) ORDER BY `report_date` DESC ;

-- --------------------------------------------------------

--
-- Structure for view `gads_recent_status_changes`
--
DROP TABLE IF EXISTS `gads_recent_status_changes`;

CREATE ALGORITHM=UNDEFINED DEFINER=`hub`@`localhost` SQL SECURITY DEFINER VIEW `gads_recent_status_changes`  AS SELECT `h`.`google_campaign_id` AS `google_campaign_id`, `h`.`campaign_name` AS `campaign_name`, `h`.`old_status_name` AS `old_status_name`, `h`.`new_status_name` AS `new_status_name`, `h`.`status_changed_at` AS `status_changed_at`, `h`.`detected_by_sync` AS `detected_by_sync`, (to_days(curdate()) - to_days(cast(`h`.`status_changed_at` as date))) AS `days_ago` FROM `gads_campaign_status_history` AS `h` WHERE (`h`.`status_changed_at` >= (curdate() - interval 30 day)) ORDER BY `h`.`status_changed_at` DESC ;

-- --------------------------------------------------------

--
-- Structure for view `hub_contacts_full`
--
DROP TABLE IF EXISTS `hub_contacts_full`;

CREATE ALGORITHM=UNDEFINED DEFINER=`hub_admin`@`localhost` SQL SECURITY DEFINER VIEW `hub_contacts_full`  AS SELECT `c`.`contact_id` AS `contact_id`, `c`.`hubspot_id` AS `hubspot_id`, `c`.`email` AS `email`, `c`.`name` AS `name`, `c`.`firstname` AS `firstname`, `c`.`lastname` AS `lastname`, `c`.`phone` AS `phone`, `c`.`country_code` AS `country_code`, `c`.`city` AS `city`, `c`.`pipeline_stage` AS `pipeline_stage`, `c`.`lifecyclestage` AS `lifecyclestage`, `c`.`hs_lead_status` AS `hs_lead_status`, `c`.`source` AS `source`, `c`.`source_detail_1` AS `source_detail_1`, `c`.`source_detail_2` AS `source_detail_2`, `c`.`createdate` AS `createdate`, `c`.`lastmodifieddate` AS `lastmodifieddate`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`hs_object_id` AS `hs_object_id`, `c`.`agent` AS `agent`, `c`.`chattedbefore` AS `chattedbefore`, `c`.`hs_all_accessible_team_ids` AS `hs_all_accessible_team_ids`, `c`.`hs_all_contact_vids` AS `hs_all_contact_vids`, `c`.`hs_all_owner_ids` AS `hs_all_owner_ids`, `c`.`hs_all_team_ids` AS `hs_all_team_ids`, `c`.`hs_analytics_average_page_views` AS `hs_analytics_average_page_views`, `c`.`hs_analytics_first_timestamp` AS `hs_analytics_first_timestamp`, `c`.`hs_analytics_num_event_completions` AS `hs_analytics_num_event_completions`, `c`.`hs_analytics_num_page_views` AS `hs_analytics_num_page_views`, `c`.`hs_analytics_num_visits` AS `hs_analytics_num_visits`, `c`.`hs_analytics_revenue` AS `hs_analytics_revenue`, `c`.`hs_analytics_source` AS `hs_analytics_source`, `c`.`hs_analytics_source_data_1` AS `hs_analytics_source_data_1`, `c`.`hs_analytics_source_data_2` AS `hs_analytics_source_data_2`, `c`.`hs_associated_target_accounts` AS `hs_associated_target_accounts`, `c`.`hs_count_is_unworked` AS `hs_count_is_unworked`, `c`.`hs_count_is_worked` AS `hs_count_is_worked`, `c`.`hs_currently_enrolled_in_prospecting_agent` AS `hs_currently_enrolled_in_prospecting_agent`, `c`.`hs_email_domain` AS `hs_email_domain`, `c`.`hs_first_outreach_date` AS `hs_first_outreach_date`, `c`.`hs_full_name_or_email` AS `hs_full_name_or_email`, `c`.`hs_is_contact` AS `hs_is_contact`, `c`.`hs_is_unworked` AS `hs_is_unworked`, `c`.`hs_latest_source` AS `hs_latest_source`, `c`.`hs_latest_source_data_1` AS `hs_latest_source_data_1`, `c`.`hs_latest_source_data_2` AS `hs_latest_source_data_2`, `c`.`hs_latest_source_timestamp` AS `hs_latest_source_timestamp`, `c`.`hs_marketable_status` AS `hs_marketable_status`, `c`.`hs_marketable_until_renewal` AS `hs_marketable_until_renewal`, `c`.`hs_membership_has_accessed_private_content` AS `hs_membership_has_accessed_private_content`, `c`.`hs_messaging_engagement_score` AS `hs_messaging_engagement_score`, `c`.`hs_notes_last_activity` AS `hs_notes_last_activity`, `c`.`hs_object_source` AS `hs_object_source`, `c`.`hs_object_source_id` AS `hs_object_source_id`, `c`.`hs_object_source_label` AS `hs_object_source_label`, `c`.`hs_pipeline` AS `hs_pipeline`, `c`.`hs_prospecting_agent_actively_enrolled_count` AS `hs_prospecting_agent_actively_enrolled_count`, `c`.`hs_prospecting_agent_total_enrolled_count` AS `hs_prospecting_agent_total_enrolled_count`, `c`.`hs_registered_member` AS `hs_registered_member`, `c`.`hs_sales_email_last_replied` AS `hs_sales_email_last_replied`, `c`.`hs_sequences_actively_enrolled_count` AS `hs_sequences_actively_enrolled_count`, `c`.`hs_social_facebook_clicks` AS `hs_social_facebook_clicks`, `c`.`hs_social_google_plus_clicks` AS `hs_social_google_plus_clicks`, `c`.`hs_social_linkedin_clicks` AS `hs_social_linkedin_clicks`, `c`.`hs_social_num_broadcast_clicks` AS `hs_social_num_broadcast_clicks`, `c`.`hs_social_twitter_clicks` AS `hs_social_twitter_clicks`, `c`.`hs_user_ids_of_all_owners` AS `hs_user_ids_of_all_owners`, `c`.`hs_v2_date_entered_lead` AS `hs_v2_date_entered_lead`, `c`.`hubspot_owner_assigneddate` AS `hubspot_owner_assigneddate`, `c`.`hubspot_owner_id` AS `hubspot_owner_id`, `c`.`hubspot_team_id` AS `hubspot_team_id`, `c`.`notes_last_updated` AS `notes_last_updated`, `c`.`num_contacted_notes` AS `num_contacted_notes`, `c`.`num_conversion_events` AS `num_conversion_events`, `c`.`num_notes` AS `num_notes`, `c`.`num_unique_conversion_events` AS `num_unique_conversion_events`, `c`.`hs_calculated_mobile_number` AS `hs_calculated_mobile_number`, `c`.`hs_calculated_phone_number` AS `hs_calculated_phone_number`, `c`.`hs_calculated_phone_number_country_code` AS `hs_calculated_phone_number_country_code`, `c`.`hs_object_source_detail_1` AS `hs_object_source_detail_1`, `c`.`hs_searchable_calculated_mobile_number` AS `hs_searchable_calculated_mobile_number`, `c`.`hs_searchable_calculated_phone_number` AS `hs_searchable_calculated_phone_number`, `c`.`hs_whatsapp_phone_number` AS `hs_whatsapp_phone_number`, `c`.`mobilephone` AS `mobilephone`, `c`.`hs_first_engagement_object_id` AS `hs_first_engagement_object_id`, `c`.`hs_notes_next_activity` AS `hs_notes_next_activity`, `c`.`hs_notes_next_activity_type` AS `hs_notes_next_activity_type`, `c`.`hs_sa_first_engagement_date` AS `hs_sa_first_engagement_date`, `c`.`hs_sa_first_engagement_descr` AS `hs_sa_first_engagement_descr`, `c`.`hs_sa_first_engagement_object_type` AS `hs_sa_first_engagement_object_type`, `c`.`hs_time_to_first_engagement` AS `hs_time_to_first_engagement`, `c`.`hs_updated_by_user_id` AS `hs_updated_by_user_id`, `c`.`notes_last_contacted` AS `notes_last_contacted`, `c`.`notes_next_activity_date` AS `notes_next_activity_date`, `c`.`first_deal_created_date` AS `first_deal_created_date`, `c`.`hs_all_assigned_business_unit_ids` AS `hs_all_assigned_business_unit_ids`, `c`.`hs_created_by_user_id` AS `hs_created_by_user_id`, `c`.`hs_last_sales_activity_date` AS `hs_last_sales_activity_date`, `c`.`hs_last_sales_activity_timestamp` AS `hs_last_sales_activity_timestamp`, `c`.`hs_last_sales_activity_type` AS `hs_last_sales_activity_type`, `c`.`hs_latest_sequence_enrolled` AS `hs_latest_sequence_enrolled`, `c`.`hs_latest_sequence_enrolled_date` AS `hs_latest_sequence_enrolled_date`, `c`.`hs_object_source_user_id` AS `hs_object_source_user_id`, `c`.`hs_sales_email_last_opened` AS `hs_sales_email_last_opened`, `c`.`hs_sequences_enrolled_count` AS `hs_sequences_enrolled_count`, `c`.`hs_sequences_is_enrolled` AS `hs_sequences_is_enrolled`, `c`.`hs_time_between_contact_creation_and_deal_creation` AS `hs_time_between_contact_creation_and_deal_creation`, `c`.`nationality` AS `nationality`, `c`.`num_associated_deals` AS `num_associated_deals`, `c`.`territory` AS `territory`, `c`.`course_weeks` AS `course_weeks`, `c`.`emailed_` AS `emailed_`, `c`.`first_conversion_date` AS `first_conversion_date`, `c`.`first_conversion_event_name` AS `first_conversion_event_name`, `c`.`ga_client_id` AS `ga_client_id`, `c`.`ga_session_id` AS `ga_session_id`, `c`.`hs_analytics_first_referrer` AS `hs_analytics_first_referrer`, `c`.`hs_analytics_first_url` AS `hs_analytics_first_url`, `c`.`hs_analytics_first_visit_timestamp` AS `hs_analytics_first_visit_timestamp`, `c`.`hs_analytics_last_referrer` AS `hs_analytics_last_referrer`, `c`.`hs_analytics_last_timestamp` AS `hs_analytics_last_timestamp`, `c`.`hs_analytics_last_url` AS `hs_analytics_last_url`, `c`.`hs_analytics_last_visit_timestamp` AS `hs_analytics_last_visit_timestamp`, `c`.`hs_calculated_form_submissions` AS `hs_calculated_form_submissions`, `c`.`hs_sales_email_last_clicked` AS `hs_sales_email_last_clicked`, `c`.`recent_conversion_date` AS `recent_conversion_date`, `c`.`gclid` AS `gclid`, `c`.`message_sum_rich` AS `message_sum_rich`, `c`.`message_summary` AS `message_summary`, `c`.`response` AS `response`, `c`.`response_1` AS `response_1`, `c`.`hs_calculated_merged_vids` AS `hs_calculated_merged_vids`, `c`.`hs_latest_sequence_ended_date` AS `hs_latest_sequence_ended_date`, `c`.`hs_latest_sequence_unenrolled_date` AS `hs_latest_sequence_unenrolled_date`, `c`.`hs_merged_object_ids` AS `hs_merged_object_ids`, `c`.`hs_v2_cumulative_time_in_lead` AS `hs_v2_cumulative_time_in_lead`, `c`.`wa_outreach` AS `wa_outreach`, `c`.`question` AS `question`, `c`.`hs_created_by_conversations` AS `hs_created_by_conversations`, `c`.`date_of_birth` AS `date_of_birth`, `c`.`hs_v2_latest_time_in_lead` AS `hs_v2_latest_time_in_lead`, `c`.`state` AS `state`, `c`.`zip` AS `zip`, `c`.`hs_latest_meeting_activity` AS `hs_latest_meeting_activity`, `c`.`hs_additional_emails` AS `hs_additional_emails`, `c`.`address` AS `address`, `c`.`associatedcompanyid` AS `associatedcompanyid`, `c`.`country` AS `country`, `c`.`academic_program` AS `academic_program`, `c`.`address_addon` AS `address_addon`, `c`.`age` AS `age`, `c`.`ai_email_closing` AS `ai_email_closing`, `c`.`ai_email_head_1` AS `ai_email_head_1`, `c`.`ai_email_head_2` AS `ai_email_head_2`, `c`.`associatedcompanylastupdated` AS `associatedcompanylastupdated`, `c`.`attendance_record` AS `attendance_record`, `c`.`chat_follow` AS `chat_follow`, `c`.`closedate` AS `closedate`, `c`.`course_end` AS `course_end`, `c`.`course_enrollment_date` AS `course_enrollment_date`, `c`.`course_graduation_date` AS `course_graduation_date`, `c`.`course_start_date` AS `course_start_date`, `c`.`days_to_close` AS `days_to_close`, `c`.`engagements_last_meeting_booked` AS `engagements_last_meeting_booked`, `c`.`first_deal` AS `first_deal`, `c`.`followercount` AS `followercount`, `c`.`gpa` AS `gpa`, `c`.`grade` AS `grade`, `c`.`hs_content_membership_email_confirmed` AS `hs_content_membership_email_confirmed`, `c`.`hs_content_membership_registered_at` AS `hs_content_membership_registered_at`, `c`.`hs_content_membership_registration_email_sent_at` AS `hs_content_membership_registration_email_sent_at`, `c`.`hs_createdate` AS `hs_createdate`, `c`.`hs_cross_sell_opportunity` AS `hs_cross_sell_opportunity`, `c`.`hs_data_privacy_ads_consent` AS `hs_data_privacy_ads_consent`, `c`.`hs_document_last_revisited` AS `hs_document_last_revisited`, `c`.`hs_email_bad_address` AS `hs_email_bad_address`, `c`.`hs_email_bounce` AS `hs_email_bounce`, `c`.`hs_email_click` AS `hs_email_click`, `c`.`hs_email_delivered` AS `hs_email_delivered`, `c`.`hs_email_last_reply_date` AS `hs_email_last_reply_date`, `c`.`hs_email_last_send_date` AS `hs_email_last_send_date`, `c`.`hs_email_open` AS `hs_email_open`, `c`.`hs_email_optout` AS `hs_email_optout`, `c`.`hs_email_quarantined` AS `hs_email_quarantined`, `c`.`hs_email_recipient_fatigue_recovery_time` AS `hs_email_recipient_fatigue_recovery_time`, `c`.`hs_email_replied` AS `hs_email_replied`, `c`.`hs_email_sends_since_last_engagement` AS `hs_email_sends_since_last_engagement`, `c`.`hs_employment_change_detected_date` AS `hs_employment_change_detected_date`, `c`.`hs_enriched_email_bounce_detected` AS `hs_enriched_email_bounce_detected`, `c`.`hs_facebook_ad_clicked` AS `hs_facebook_ad_clicked`, `c`.`hs_first_closed_order_id` AS `hs_first_closed_order_id`, `c`.`hs_first_order_closed_date` AS `hs_first_order_closed_date`, `c`.`hs_is_enriched` AS `hs_is_enriched`, `c`.`hs_last_metered_enrichment_timestamp` AS `hs_last_metered_enrichment_timestamp`, `c`.`hs_last_sms_send_date` AS `hs_last_sms_send_date`, `c`.`hs_lastmodifieddate` AS `hs_lastmodifieddate`, `c`.`hs_latest_disqualified_lead_date` AS `hs_latest_disqualified_lead_date`, `c`.`hs_latest_open_lead_date` AS `hs_latest_open_lead_date`, `c`.`hs_latest_qualified_lead_date` AS `hs_latest_qualified_lead_date`, `c`.`hs_latest_sequence_finished_date` AS `hs_latest_sequence_finished_date`, `c`.`hs_latest_subscription_create_date` AS `hs_latest_subscription_create_date`, `c`.`hs_latitude` AS `hs_latitude`, `c`.`hs_read_only` AS `hs_read_only`, `c`.`hs_was_imported` AS `hs_was_imported`, `c`.`currentlyinworkflow` AS `currentlyinworkflow`, `c`.`ai_email_intro` AS `ai_email_intro`, `c`.`ai_email_subject` AS `ai_email_subject`, `c`.`annualrevenue` AS `annualrevenue`, `c`.`company` AS `company`, `c`.`company_size` AS `company_size`, `c`.`contact_notes` AS `contact_notes`, `c`.`course_duration` AS `course_duration`, `c`.`course_type` AS `course_type`, `c`.`degree` AS `degree`, `c`.`email_2` AS `email_2`, `c`.`engagements_last_meeting_booked_campaign` AS `engagements_last_meeting_booked_campaign`, `c`.`engagements_last_meeting_booked_medium` AS `engagements_last_meeting_booked_medium`, `c`.`engagements_last_meeting_booked_source` AS `engagements_last_meeting_booked_source`, `c`.`enrollment_status` AS `enrollment_status`, `c`.`existing_customer_` AS `existing_customer_`, `c`.`facebook` AS `facebook`, `c`.`fax` AS `fax`, `c`.`field_of_study` AS `field_of_study`, `c`.`followup` AS `followup`, `c`.`hs_longitude` AS `hs_longitude`, `c`.`hs_pinned_engagement_id` AS `hs_pinned_engagement_id`, `c`.`hs_predictivecontactscore` AS `hs_predictivecontactscore`, `c`.`hs_predictivecontactscore_v2` AS `hs_predictivecontactscore_v2`, `c`.`hs_quarantined_emails` AS `hs_quarantined_emails`, `c`.`hs_recent_closed_order_date` AS `hs_recent_closed_order_date`, `c`.`hs_returning_to_office_detected_date` AS `hs_returning_to_office_detected_date`, `c`.`hs_searchable_calculated_international_mobile_number` AS `hs_searchable_calculated_international_mobile_number`, `c`.`hs_searchable_calculated_international_phone_number` AS `hs_searchable_calculated_international_phone_number`, `c`.`hs_social_last_engagement` AS `hs_social_last_engagement`, `c`.`hs_source_object_id` AS `hs_source_object_id`, `c`.`hs_source_portal_id` AS `hs_source_portal_id`, `c`.`hs_time_between_contact_creation_and_deal_close` AS `hs_time_between_contact_creation_and_deal_close`, `c`.`hs_time_to_move_from_lead_to_customer` AS `hs_time_to_move_from_lead_to_customer`, `c`.`hs_time_to_move_from_marketingqualifiedlead_to_customer` AS `hs_time_to_move_from_marketingqualifiedlead_to_customer`, `c`.`hs_time_to_move_from_opportunity_to_customer` AS `hs_time_to_move_from_opportunity_to_customer`, `c`.`hs_time_to_move_from_salesqualifiedlead_to_customer` AS `hs_time_to_move_from_salesqualifiedlead_to_customer`, `c`.`hs_time_to_move_from_subscriber_to_customer` AS `hs_time_to_move_from_subscriber_to_customer`, `c`.`hs_v2_cumulative_time_in_customer` AS `hs_v2_cumulative_time_in_customer`, `c`.`hs_v2_cumulative_time_in_evangelist` AS `hs_v2_cumulative_time_in_evangelist`, `c`.`hs_v2_cumulative_time_in_marketingqualifiedlead` AS `hs_v2_cumulative_time_in_marketingqualifiedlead`, `c`.`hs_v2_cumulative_time_in_opportunity` AS `hs_v2_cumulative_time_in_opportunity`, `c`.`hs_v2_cumulative_time_in_other` AS `hs_v2_cumulative_time_in_other`, `c`.`hs_v2_cumulative_time_in_salesqualifiedlead` AS `hs_v2_cumulative_time_in_salesqualifiedlead`, `c`.`hs_v2_cumulative_time_in_subscriber` AS `hs_v2_cumulative_time_in_subscriber`, `c`.`hs_v2_date_entered_customer` AS `hs_v2_date_entered_customer`, `c`.`hs_v2_date_entered_evangelist` AS `hs_v2_date_entered_evangelist`, `c`.`hs_v2_date_entered_marketingqualifiedlead` AS `hs_v2_date_entered_marketingqualifiedlead`, `c`.`hs_v2_date_entered_opportunity` AS `hs_v2_date_entered_opportunity`, `c`.`hs_v2_date_entered_other` AS `hs_v2_date_entered_other`, `c`.`hs_v2_date_entered_salesqualifiedlead` AS `hs_v2_date_entered_salesqualifiedlead`, `c`.`hs_v2_date_exited_customer` AS `hs_v2_date_exited_customer`, `c`.`hs_v2_date_exited_evangelist` AS `hs_v2_date_exited_evangelist`, `c`.`hs_v2_date_exited_marketingqualifiedlead` AS `hs_v2_date_exited_marketingqualifiedlead`, `c`.`hs_v2_date_exited_opportunity` AS `hs_v2_date_exited_opportunity`, `c`.`hs_v2_date_exited_other` AS `hs_v2_date_exited_other`, `c`.`hs_v2_date_exited_salesqualifiedlead` AS `hs_v2_date_exited_salesqualifiedlead`, `c`.`hs_v2_date_exited_subscriber` AS `hs_v2_date_exited_subscriber`, `c`.`hs_v2_latest_time_in_customer` AS `hs_v2_latest_time_in_customer`, `c`.`hs_v2_latest_time_in_evangelist` AS `hs_v2_latest_time_in_evangelist`, `c`.`hs_v2_latest_time_in_marketingqualifiedlead` AS `hs_v2_latest_time_in_marketingqualifiedlead`, `c`.`hs_v2_latest_time_in_opportunity` AS `hs_v2_latest_time_in_opportunity`, `c`.`hs_v2_latest_time_in_other` AS `hs_v2_latest_time_in_other`, `c`.`hs_v2_latest_time_in_salesqualifiedlead` AS `hs_v2_latest_time_in_salesqualifiedlead`, `c`.`hs_v2_latest_time_in_subscriber` AS `hs_v2_latest_time_in_subscriber`, `c`.`hubspotscore` AS `hubspotscore`, `c`.`msg_summary` AS `msg_summary`, `c`.`recent_deal_amount` AS `recent_deal_amount`, `c`.`recent_deal_close_date` AS `recent_deal_close_date`, `c`.`total_revenue` AS `total_revenue`, `c`.`formissue` AS `formissue`, `c`.`gender` AS `gender`, `c`.`google_ads_campaign` AS `google_ads_campaign`, `c`.`graduation_date` AS `graduation_date`, `c`.`high_value_students` AS `high_value_students`, `c`.`hs_analytics_first_touch_converting_campaign` AS `hs_analytics_first_touch_converting_campaign`, `c`.`hs_analytics_last_touch_converting_campaign` AS `hs_analytics_last_touch_converting_campaign`, `c`.`hs_avatar_filemanager_key` AS `hs_avatar_filemanager_key`, `c`.`hs_buying_role` AS `hs_buying_role`, `c`.`hs_calculated_phone_number_area_code` AS `hs_calculated_phone_number_area_code`, `c`.`hs_calculated_phone_number_region_code` AS `hs_calculated_phone_number_region_code`, `c`.`hs_clicked_linkedin_ad` AS `hs_clicked_linkedin_ad`, `c`.`hs_content_membership_email` AS `hs_content_membership_email`, `c`.`hs_content_membership_status` AS `hs_content_membership_status`, `c`.`hs_conversations_visitor_email` AS `hs_conversations_visitor_email`, `c`.`hs_country_region_code` AS `hs_country_region_code`, `c`.`hs_ip_timezone` AS `hs_ip_timezone`, `c`.`hs_timezone` AS `hs_timezone`, `c`.`ip_city` AS `ip_city`, `c`.`ip_country` AS `ip_country`, `c`.`ip_country_code` AS `ip_country_code`, `c`.`ip_state` AS `ip_state`, `c`.`ip_state_code` AS `ip_state_code`, `c`.`spam` AS `spam`, `c`.`level` AS `level`, `c`.`hs_email_hard_bounce_reason_enum` AS `hs_email_hard_bounce_reason_enum`, `c`.`start_date` AS `start_date`, `c`.`hs_facebook_click_id` AS `hs_facebook_click_id`, `c`.`hs_email_optout_156423875` AS `hs_email_optout_156423875`, `c`.`hs_email_optout_156585599` AS `hs_email_optout_156585599`, `c`.`previous_partner_schools_1` AS `previous_partner_schools_1`, `c`.`hs_customer_agent_lead_status` AS `hs_customer_agent_lead_status`, `c`.`hs_email_customer_quarantined_reason` AS `hs_email_customer_quarantined_reason`, `c`.`hs_email_hard_bounce_reason` AS `hs_email_hard_bounce_reason`, `c`.`hs_email_last_email_name` AS `hs_email_last_email_name`, `c`.`hs_email_optimal_send_day_of_week` AS `hs_email_optimal_send_day_of_week`, `c`.`hs_email_optimal_send_time_of_day` AS `hs_email_optimal_send_time_of_day`, `c`.`hs_email_optout_survey_reason` AS `hs_email_optout_survey_reason`, `c`.`hs_email_quarantined_reason` AS `hs_email_quarantined_reason`, `c`.`hs_emailconfirmationstatus` AS `hs_emailconfirmationstatus`, `c`.`hs_facebookid` AS `hs_facebookid`, `c`.`hs_feedback_last_ces_survey_follow_up` AS `hs_feedback_last_ces_survey_follow_up`, `c`.`hs_feedback_last_csat_survey_follow_up` AS `hs_feedback_last_csat_survey_follow_up`, `c`.`hs_feedback_last_nps_follow_up` AS `hs_feedback_last_nps_follow_up`, `c`.`hs_feedback_last_nps_rating` AS `hs_feedback_last_nps_rating`, `c`.`hs_googleplusid` AS `hs_googleplusid`, `c`.`hs_gps_error` AS `hs_gps_error`, `c`.`hs_gps_latitude` AS `hs_gps_latitude`, `c`.`hs_gps_longitude` AS `hs_gps_longitude`, `c`.`hs_inferred_language_codes` AS `hs_inferred_language_codes`, `c`.`hs_journey_stage` AS `hs_journey_stage`, `c`.`hs_language` AS `hs_language`, `c`.`hs_last_sms_send_name` AS `hs_last_sms_send_name`, `c`.`hs_legal_basis` AS `hs_legal_basis`, `c`.`hs_linkedin_ad_clicked` AS `hs_linkedin_ad_clicked`, `c`.`hs_linkedin_url` AS `hs_linkedin_url`, `c`.`hs_linkedinid` AS `hs_linkedinid`, `c`.`hs_marketable_reason_id` AS `hs_marketable_reason_id`, `c`.`hs_marketable_reason_type` AS `hs_marketable_reason_type`, `c`.`hs_mobile_sdk_push_tokens` AS `hs_mobile_sdk_push_tokens`, `c`.`hs_object_source_detail_2` AS `hs_object_source_detail_2`, `c`.`hs_object_source_detail_3` AS `hs_object_source_detail_3`, `c`.`hs_owning_teams` AS `hs_owning_teams`, `c`.`hs_persona` AS `hs_persona`, `c`.`hs_predictivecontactscorebucket` AS `hs_predictivecontactscorebucket`, `c`.`hs_predictivescoringtier` AS `hs_predictivescoringtier`, `c`.`hs_registration_method` AS `hs_registration_method`, `c`.`hs_role` AS `hs_role`, `c`.`hs_seniority` AS `hs_seniority`, `c`.`hs_shared_team_ids` AS `hs_shared_team_ids`, `c`.`hs_shared_user_ids` AS `hs_shared_user_ids`, `c`.`hs_state_code` AS `hs_state_code`, `c`.`hs_sub_role` AS `hs_sub_role`, `c`.`hs_testpurge` AS `hs_testpurge`, `c`.`hs_testrollback` AS `hs_testrollback`, `c`.`hs_twitterid` AS `hs_twitterid`, `c`.`hs_unique_creation_key` AS `hs_unique_creation_key`, `c`.`quiz_score` AS `quiz_score`, `c`.`adgroup` AS `adgroup`, `c`.`department` AS `department`, `c`.`financial_aid_status` AS `financial_aid_status`, `c`.`hs_contact_enrichment_opt_out` AS `hs_contact_enrichment_opt_out`, `c`.`hs_contact_enrichment_opt_out_timestamp` AS `hs_contact_enrichment_opt_out_timestamp`, `c`.`hs_content_membership_follow_up_enqueued_at` AS `hs_content_membership_follow_up_enqueued_at`, `c`.`hs_content_membership_notes` AS `hs_content_membership_notes`, `c`.`hs_content_membership_registration_domain_sent_to` AS `hs_content_membership_registration_domain_sent_to`, `c`.`hs_email_first_click_date` AS `hs_email_first_click_date`, `c`.`hs_email_first_open_date` AS `hs_email_first_open_date`, `c`.`hs_email_first_reply_date` AS `hs_email_first_reply_date`, `c`.`hs_email_first_send_date` AS `hs_email_first_send_date`, `c`.`hs_email_is_ineligible` AS `hs_email_is_ineligible`, `c`.`hs_email_last_click_date` AS `hs_email_last_click_date`, `c`.`hs_email_last_open_date` AS `hs_email_last_open_date`, `c`.`hs_feedback_last_ces_survey_date` AS `hs_feedback_last_ces_survey_date`, `c`.`hs_feedback_last_ces_survey_rating` AS `hs_feedback_last_ces_survey_rating`, `c`.`hs_feedback_last_csat_survey_date` AS `hs_feedback_last_csat_survey_date`, `c`.`hs_feedback_last_csat_survey_rating` AS `hs_feedback_last_csat_survey_rating`, `c`.`hs_feedback_last_survey_date` AS `hs_feedback_last_survey_date`, `c`.`hs_feedback_show_nps_web_survey` AS `hs_feedback_show_nps_web_survey`, `c`.`hs_first_subscription_create_date` AS `hs_first_subscription_create_date`, `c`.`hs_google_click_id` AS `hs_google_click_id`, `c`.`hs_has_active_subscription` AS `hs_has_active_subscription`, `c`.`hs_job_change_detected_date` AS `hs_job_change_detected_date`, `c`.`hs_live_enrichment_deadline` AS `hs_live_enrichment_deadline`, `c`.`hs_membership_last_private_content_access_date` AS `hs_membership_last_private_content_access_date`, `c`.`hs_prospecting_agent_last_enrolled` AS `hs_prospecting_agent_last_enrolled`, `c`.`hs_v2_date_entered_subscriber` AS `hs_v2_date_entered_subscriber`, `c`.`hs_v2_date_exited_lead` AS `hs_v2_date_exited_lead`, `c`.`jobtitle` AS `jobtitle`, `c`.`kloutscoregeneral` AS `kloutscoregeneral`, `c`.`linkedinconnections` AS `linkedinconnections`, `e`.`hs_intent_signals_enabled` AS `hs_intent_signals_enabled`, `e`.`hs_intent_paid_up_to_date` AS `hs_intent_paid_up_to_date`, `e`.`webinareventlastupdated` AS `webinareventlastupdated`, `e`.`surveymonkeyeventlastupdated` AS `surveymonkeyeventlastupdated`, `e`.`message` AS `message`, `e`.`created_at` AS `ext_created_at`, `e`.`updated_at` AS `ext_updated_at` FROM (`hub_contacts` `c` left join `hub_contacts_ext` `e` on((`c`.`hubspot_id` = `e`.`hubspot_id`))) ;

-- --------------------------------------------------------

--
-- Structure for view `hub_deals_full`
--
DROP TABLE IF EXISTS `hub_deals_full`;

CREATE ALGORITHM=UNDEFINED DEFINER=`hub_admin`@`localhost` SQL SECURITY DEFINER VIEW `hub_deals_full`  AS SELECT `d`.`deal_id` AS `deal_id`, `d`.`hubspot_deal_id` AS `hubspot_deal_id`, `d`.`dealname` AS `dealname`, `d`.`amount` AS `amount`, `d`.`amount_in_home_currency` AS `amount_in_home_currency`, `d`.`currency` AS `currency`, `d`.`pipeline_stage` AS `pipeline_stage`, `d`.`dealstage` AS `dealstage`, `d`.`pipeline` AS `pipeline`, `d`.`hs_deal_stage_probability` AS `hs_deal_stage_probability`, `d`.`closedate` AS `closedate`, `d`.`deal_type` AS `deal_type`, `d`.`source` AS `source`, `d`.`probability` AS `probability`, `d`.`createdate` AS `createdate`, `d`.`lastmodifieddate` AS `lastmodifieddate`, `d`.`created_at` AS `created_at`, `d`.`updated_at` AS `updated_at`, `d`.`hs_lastmodifieddate` AS `hs_lastmodifieddate`, `d`.`hs_object_id` AS `hs_object_id`, `d`.`days_to_close` AS `days_to_close`, `d`.`deal_currency_code` AS `deal_currency_code`, `d`.`hs_acv` AS `hs_acv`, `d`.`hs_all_accessible_team_ids` AS `hs_all_accessible_team_ids`, `d`.`hs_all_assigned_business_unit_ids` AS `hs_all_assigned_business_unit_ids`, `d`.`hs_all_owner_ids` AS `hs_all_owner_ids`, `d`.`hs_all_team_ids` AS `hs_all_team_ids`, `d`.`hs_analytics_latest_source` AS `hs_analytics_latest_source`, `d`.`hs_analytics_latest_source_contact` AS `hs_analytics_latest_source_contact`, `d`.`hs_analytics_latest_source_data_1` AS `hs_analytics_latest_source_data_1`, `d`.`hs_analytics_latest_source_data_1_contact` AS `hs_analytics_latest_source_data_1_contact`, `d`.`hs_analytics_latest_source_data_2` AS `hs_analytics_latest_source_data_2`, `d`.`hs_analytics_latest_source_data_2_contact` AS `hs_analytics_latest_source_data_2_contact`, `d`.`hs_analytics_latest_source_timestamp` AS `hs_analytics_latest_source_timestamp`, `d`.`hs_analytics_latest_source_timestamp_contact` AS `hs_analytics_latest_source_timestamp_contact`, `d`.`hs_analytics_source` AS `hs_analytics_source`, `d`.`hs_analytics_source_data_1` AS `hs_analytics_source_data_1`, `d`.`hs_analytics_source_data_2` AS `hs_analytics_source_data_2`, `d`.`hs_arr` AS `hs_arr`, `d`.`hs_attributed_team_ids` AS `hs_attributed_team_ids`, `d`.`hs_closed_amount` AS `hs_closed_amount`, `d`.`hs_closed_amount_in_home_currency` AS `hs_closed_amount_in_home_currency`, `d`.`hs_closed_deal_close_date` AS `hs_closed_deal_close_date`, `d`.`hs_closed_deal_create_date` AS `hs_closed_deal_create_date`, `d`.`hs_closed_won_count` AS `hs_closed_won_count`, `d`.`hs_created_by_user_id` AS `hs_created_by_user_id`, `d`.`hs_createdate` AS `hs_createdate`, `d`.`hs_days_to_close_raw` AS `hs_days_to_close_raw`, `d`.`hs_deal_score` AS `hs_deal_score`, `d`.`hs_deal_stage_probability_shadow` AS `hs_deal_stage_probability_shadow`, `d`.`hs_duration` AS `hs_duration`, `d`.`hs_exchange_rate` AS `hs_exchange_rate`, `d`.`hs_forecast_amount` AS `hs_forecast_amount`, `d`.`hs_is_closed` AS `hs_is_closed`, `d`.`hs_is_closed_count` AS `hs_is_closed_count`, `d`.`hs_is_closed_lost` AS `hs_is_closed_lost`, `d`.`hs_is_closed_won` AS `hs_is_closed_won`, `d`.`hs_is_deal_split` AS `hs_is_deal_split`, `d`.`hs_is_in_first_deal_stage` AS `hs_is_in_first_deal_stage`, `d`.`hs_is_open_count` AS `hs_is_open_count`, `d`.`hs_is_stalled` AS `hs_is_stalled`, `d`.`hs_latest_sales_email_open_date` AS `hs_latest_sales_email_open_date`, `d`.`hs_mrr` AS `hs_mrr`, `d`.`hs_notes_last_activity` AS `hs_notes_last_activity`, `d`.`hs_num_associated_active_deal_registrations` AS `hs_num_associated_active_deal_registrations`, `d`.`hs_num_associated_deal_registrations` AS `hs_num_associated_deal_registrations`, `d`.`hs_num_associated_deal_splits` AS `hs_num_associated_deal_splits`, `d`.`hs_num_of_associated_line_items` AS `hs_num_of_associated_line_items`, `d`.`hs_num_target_accounts` AS `hs_num_target_accounts`, `d`.`hs_number_of_call_engagements` AS `hs_number_of_call_engagements`, `d`.`hs_number_of_inbound_calls` AS `hs_number_of_inbound_calls`, `d`.`hs_number_of_outbound_calls` AS `hs_number_of_outbound_calls`, `d`.`hs_number_of_overdue_tasks` AS `hs_number_of_overdue_tasks`, `d`.`hs_object_source` AS `hs_object_source`, `d`.`hs_object_source_id` AS `hs_object_source_id`, `d`.`hs_object_source_label` AS `hs_object_source_label`, `d`.`hs_object_source_user_id` AS `hs_object_source_user_id`, `d`.`hs_open_amount_in_home_currency` AS `hs_open_amount_in_home_currency`, `d`.`hs_open_deal_create_date` AS `hs_open_deal_create_date`, `d`.`hs_projected_amount` AS `hs_projected_amount`, `d`.`hs_projected_amount_in_home_currency` AS `hs_projected_amount_in_home_currency`, `d`.`hs_tcv` AS `hs_tcv`, `d`.`hs_updated_by_user_id` AS `hs_updated_by_user_id`, `d`.`hs_user_ids_of_all_owners` AS `hs_user_ids_of_all_owners`, `d`.`hs_v2_date_entered_113151423` AS `hs_v2_date_entered_113151423`, `d`.`hs_v2_date_entered_current_stage` AS `hs_v2_date_entered_current_stage`, `d`.`hs_v2_time_in_current_stage` AS `hs_v2_time_in_current_stage`, `d`.`hubspot_owner_assigneddate` AS `hubspot_owner_assigneddate`, `d`.`hubspot_owner_id` AS `hubspot_owner_id`, `d`.`hubspot_team_id` AS `hubspot_team_id`, `d`.`notes_last_contacted` AS `notes_last_contacted`, `d`.`notes_last_updated` AS `notes_last_updated`, `d`.`num_associated_contacts` AS `num_associated_contacts`, `d`.`num_contacted_notes` AS `num_contacted_notes`, `d`.`num_notes` AS `num_notes`, `d`.`territory` AS `territory`, `d`.`hs_latest_sales_email_click_date` AS `hs_latest_sales_email_click_date`, `d`.`hs_manual_forecast_category` AS `hs_manual_forecast_category`, `d`.`hs_object_source_detail_1` AS `hs_object_source_detail_1`, `d`.`hs_v2_cumulative_time_in_113151423` AS `hs_v2_cumulative_time_in_113151423`, `d`.`hs_v2_cumulative_time_in_appointmentscheduled` AS `hs_v2_cumulative_time_in_appointmentscheduled`, `d`.`hs_v2_date_entered_appointmentscheduled` AS `hs_v2_date_entered_appointmentscheduled`, `d`.`hs_v2_date_entered_qualifiedtobuy` AS `hs_v2_date_entered_qualifiedtobuy`, `d`.`hs_v2_date_exited_113151423` AS `hs_v2_date_exited_113151423`, `d`.`hs_v2_date_exited_appointmentscheduled` AS `hs_v2_date_exited_appointmentscheduled`, `d`.`hs_v2_latest_time_in_113151423` AS `hs_v2_latest_time_in_113151423`, `d`.`hs_v2_latest_time_in_appointmentscheduled` AS `hs_v2_latest_time_in_appointmentscheduled`, `d`.`createquote` AS `createquote`, `d`.`deal_product_course` AS `deal_product_course`, `d`.`description` AS `description`, `d`.`hs_latest_sales_email_reply_date` AS `hs_latest_sales_email_reply_date`, `d`.`increment` AS `increment`, `d`.`quote_number` AS `quote_number`, `d`.`course_duration` AS `course_duration`, `d`.`course_end` AS `course_end`, `d`.`course_start` AS `course_start`, `d`.`course_type` AS `course_type`, `d`.`hs_closed_won_date` AS `hs_closed_won_date`, `d`.`hs_notes_next_activity` AS `hs_notes_next_activity`, `d`.`hs_notes_next_activity_type` AS `hs_notes_next_activity_type`, `d`.`hs_sales_email_last_replied` AS `hs_sales_email_last_replied`, `d`.`hs_v2_cumulative_time_in_decisionmakerboughtin` AS `hs_v2_cumulative_time_in_decisionmakerboughtin`, `d`.`hs_v2_date_entered_closedwon` AS `hs_v2_date_entered_closedwon`, `d`.`hs_v2_date_entered_decisionmakerboughtin` AS `hs_v2_date_entered_decisionmakerboughtin`, `d`.`hs_v2_date_exited_decisionmakerboughtin` AS `hs_v2_date_exited_decisionmakerboughtin`, `d`.`hs_v2_latest_time_in_decisionmakerboughtin` AS `hs_v2_latest_time_in_decisionmakerboughtin`, `d`.`notes_next_activity_date` AS `notes_next_activity_date`, `d`.`closed_lost_reason` AS `closed_lost_reason`, `d`.`hs_v2_date_entered_closedlost` AS `hs_v2_date_entered_closedlost`, `d`.`hs_v2_cumulative_time_in_767120827` AS `hs_v2_cumulative_time_in_767120827`, `d`.`hs_v2_date_entered_767120827` AS `hs_v2_date_entered_767120827`, `d`.`hs_v2_date_exited_767120827` AS `hs_v2_date_exited_767120827`, `d`.`hs_v2_latest_time_in_767120827` AS `hs_v2_latest_time_in_767120827`, `d`.`hs_v2_cumulative_time_in_qualifiedtobuy` AS `hs_v2_cumulative_time_in_qualifiedtobuy`, `d`.`hs_v2_date_exited_qualifiedtobuy` AS `hs_v2_date_exited_qualifiedtobuy`, `d`.`hs_v2_latest_time_in_qualifiedtobuy` AS `hs_v2_latest_time_in_qualifiedtobuy`, `d`.`hs_analytics_latest_source_company` AS `hs_analytics_latest_source_company`, `d`.`hs_analytics_latest_source_data_1_company` AS `hs_analytics_latest_source_data_1_company`, `d`.`hs_analytics_latest_source_data_2_company` AS `hs_analytics_latest_source_data_2_company`, `d`.`hs_analytics_latest_source_timestamp_company` AS `hs_analytics_latest_source_timestamp_company`, `d`.`hs_primary_associated_company` AS `hs_primary_associated_company`, `d`.`hs_v2_date_entered_109570243` AS `hs_v2_date_entered_109570243`, `d`.`dealtype` AS `dealtype`, `d`.`hs_v2_date_entered_contractsent` AS `hs_v2_date_entered_contractsent`, `d`.`hs_v2_date_entered_109570258` AS `hs_v2_date_entered_109570258`, `d`.`hs_v2_date_entered_104175586` AS `hs_v2_date_entered_104175586`, `d`.`hs_v2_cumulative_time_in_109570260` AS `hs_v2_cumulative_time_in_109570260`, `d`.`hs_v2_date_entered_109570260` AS `hs_v2_date_entered_109570260`, `d`.`hs_v2_date_entered_109570262` AS `hs_v2_date_entered_109570262`, `d`.`hs_v2_date_exited_109570260` AS `hs_v2_date_exited_109570260`, `d`.`hs_v2_latest_time_in_109570260` AS `hs_v2_latest_time_in_109570260`, `d`.`hs_v2_cumulative_time_in_109570257` AS `hs_v2_cumulative_time_in_109570257`, `d`.`hs_v2_date_entered_109570257` AS `hs_v2_date_entered_109570257`, `d`.`hs_v2_date_exited_109570257` AS `hs_v2_date_exited_109570257`, `d`.`hs_v2_latest_time_in_109570257` AS `hs_v2_latest_time_in_109570257`, `d`.`hs_v2_date_entered_104175587` AS `hs_v2_date_entered_104175587`, `d`.`closed_won_reason` AS `closed_won_reason`, `d`.`contact_email` AS `contact_email`, `d`.`contact_enrolled_in_sequence` AS `contact_enrolled_in_sequence`, `d`.`engagements_last_meeting_booked` AS `engagements_last_meeting_booked`, `d`.`engagements_last_meeting_booked_campaign` AS `engagements_last_meeting_booked_campaign`, `d`.`engagements_last_meeting_booked_medium` AS `engagements_last_meeting_booked_medium`, `d`.`engagements_last_meeting_booked_source` AS `engagements_last_meeting_booked_source`, `d`.`high_value` AS `high_value`, `d`.`high_value_students_2` AS `high_value_students_2`, `d`.`hs_all_collaborator_owner_ids` AS `hs_all_collaborator_owner_ids`, `d`.`hs_all_deal_split_owner_ids` AS `hs_all_deal_split_owner_ids`, `d`.`hs_associated_deal_registration_deal_type` AS `hs_associated_deal_registration_deal_type`, `d`.`hs_associated_deal_registration_product_interests` AS `hs_associated_deal_registration_product_interests`, `d`.`hs_average_call_duration` AS `hs_average_call_duration`, `d`.`hs_campaign` AS `hs_campaign`, `d`.`hs_date_entered_104175584` AS `hs_date_entered_104175584`, `d`.`hs_date_entered_104175585` AS `hs_date_entered_104175585`, `d`.`hs_date_entered_104175586` AS `hs_date_entered_104175586`, `d`.`hs_date_entered_104175587` AS `hs_date_entered_104175587`, `d`.`hs_date_entered_104175588` AS `hs_date_entered_104175588`, `d`.`hs_date_entered_104175589` AS `hs_date_entered_104175589`, `d`.`hs_date_entered_104175590` AS `hs_date_entered_104175590`, `d`.`hs_date_entered_109570243` AS `hs_date_entered_109570243`, `d`.`hs_date_entered_109570257` AS `hs_date_entered_109570257`, `d`.`hs_date_entered_109570258` AS `hs_date_entered_109570258`, `d`.`hs_date_entered_109570259` AS `hs_date_entered_109570259`, `d`.`hs_date_entered_109570260` AS `hs_date_entered_109570260`, `d`.`hs_date_entered_109570261` AS `hs_date_entered_109570261`, `d`.`hs_date_entered_109570262` AS `hs_date_entered_109570262`, `d`.`hs_date_entered_109570263` AS `hs_date_entered_109570263`, `d`.`hs_date_entered_111070952` AS `hs_date_entered_111070952`, `d`.`hs_date_entered_113151423` AS `hs_date_entered_113151423`, `d`.`hs_date_entered_114331579` AS `hs_date_entered_114331579`, `d`.`hs_date_entered_1555217649` AS `hs_date_entered_1555217649`, `d`.`hs_date_entered_767120827` AS `hs_date_entered_767120827`, `d`.`hs_date_exited_104175584` AS `hs_date_exited_104175584`, `d`.`hs_date_exited_104175585` AS `hs_date_exited_104175585`, `d`.`hs_date_exited_104175586` AS `hs_date_exited_104175586`, `d`.`hs_date_exited_104175587` AS `hs_date_exited_104175587`, `d`.`hs_date_exited_104175588` AS `hs_date_exited_104175588`, `d`.`hs_date_exited_104175589` AS `hs_date_exited_104175589`, `d`.`hs_date_exited_104175590` AS `hs_date_exited_104175590`, `d`.`hs_date_exited_109570243` AS `hs_date_exited_109570243`, `d`.`hs_date_exited_109570257` AS `hs_date_exited_109570257`, `d`.`hs_date_exited_109570258` AS `hs_date_exited_109570258`, `d`.`hs_date_exited_109570259` AS `hs_date_exited_109570259`, `d`.`hs_date_exited_109570260` AS `hs_date_exited_109570260`, `d`.`hs_date_exited_109570261` AS `hs_date_exited_109570261`, `d`.`hs_date_exited_109570262` AS `hs_date_exited_109570262`, `d`.`hs_date_exited_109570263` AS `hs_date_exited_109570263`, `d`.`hs_date_exited_111070952` AS `hs_date_exited_111070952`, `d`.`hs_date_exited_113151423` AS `hs_date_exited_113151423`, `d`.`hs_date_exited_114331579` AS `hs_date_exited_114331579`, `d`.`hs_date_exited_1555217649` AS `hs_date_exited_1555217649`, `d`.`hs_date_exited_767120827` AS `hs_date_exited_767120827`, `d`.`hs_deal_amount_calculation_preference` AS `hs_deal_amount_calculation_preference`, `d`.`hs_deal_registration_mrr` AS `hs_deal_registration_mrr`, `d`.`hs_deal_registration_mrr_currency_code` AS `hs_deal_registration_mrr_currency_code`, `d`.`hs_forecast_probability` AS `hs_forecast_probability`, `d`.`hs_has_empty_conditional_stage_properties` AS `hs_has_empty_conditional_stage_properties`, `d`.`hs_is_active_shared_deal` AS `hs_is_active_shared_deal`, `d`.`hs_is_stalled_after_timestamp` AS `hs_is_stalled_after_timestamp`, `d`.`hs_latest_approval_status` AS `hs_latest_approval_status`, `d`.`hs_latest_approval_status_approval_id` AS `hs_latest_approval_status_approval_id`, `d`.`hs_latest_marketing_email_click_date` AS `hs_latest_marketing_email_click_date`, `d`.`hs_latest_marketing_email_open_date` AS `hs_latest_marketing_email_open_date`, `d`.`hs_latest_marketing_email_reply_date` AS `hs_latest_marketing_email_reply_date`, `d`.`hs_latest_meeting_activity` AS `hs_latest_meeting_activity`, `d`.`hs_likelihood_to_close` AS `hs_likelihood_to_close`, `d`.`hs_line_item_global_term_hs_discount_percentage` AS `hs_line_item_global_term_hs_discount_percentage`, `d`.`hs_line_item_global_term_hs_discount_percentage_enabled` AS `hs_line_item_global_term_hs_discount_percentage_enabled`, `d`.`hs_line_item_global_term_hs_recurring_billing_period` AS `hs_line_item_global_term_hs_recurring_billing_period`, `d`.`hs_line_item_global_term_hs_recurring_billing_period_enabled` AS `hs_line_item_global_term_hs_recurring_billing_period_enabled`, `d`.`hs_line_item_global_term_hs_recurring_billing_start_date` AS `hs_line_item_global_term_hs_recurring_billing_start_date`, `d`.`hs_line_item_global_term_hs_recurring_billing_start_date_enabled` AS `hs_line_item_global_term_hs_recurring_billing_start_date_enabled`, `d`.`hs_line_item_global_term_recurringbillingfrequency` AS `hs_line_item_global_term_recurringbillingfrequency`, `d`.`hs_line_item_global_term_recurringbillingfrequency_enabled` AS `hs_line_item_global_term_recurringbillingfrequency_enabled`, `d`.`hs_manual_campaign_ids` AS `hs_manual_campaign_ids`, `d`.`hs_merged_object_ids` AS `hs_merged_object_ids`, `d`.`hs_net_pipeline_impact` AS `hs_net_pipeline_impact`, `d`.`hs_next_meeting_id` AS `hs_next_meeting_id`, `d`.`hs_next_meeting_name` AS `hs_next_meeting_name`, `d`.`hs_next_meeting_start_time` AS `hs_next_meeting_start_time`, `d`.`hs_next_step` AS `hs_next_step`, `d`.`hs_next_step_updated_at` AS `hs_next_step_updated_at`, `d`.`hs_number_of_scheduled_meetings` AS `hs_number_of_scheduled_meetings`, `d`.`hs_object_source_detail_2` AS `hs_object_source_detail_2`, `d`.`hs_object_source_detail_3` AS `hs_object_source_detail_3`, `d`.`hs_owning_teams` AS `hs_owning_teams`, `d`.`hs_pinned_engagement_id` AS `hs_pinned_engagement_id`, `d`.`hs_predicted_amount` AS `hs_predicted_amount`, `d`.`hs_predicted_amount_in_home_currency` AS `hs_predicted_amount_in_home_currency`, `d`.`hs_priority` AS `hs_priority`, `d`.`hs_read_only` AS `hs_read_only`, `d`.`hs_shared_team_ids` AS `hs_shared_team_ids`, `d`.`hs_shared_user_ids` AS `hs_shared_user_ids`, `d`.`hs_source_object_id` AS `hs_source_object_id`, `d`.`hs_synced_deal_owner_name_and_email` AS `hs_synced_deal_owner_name_and_email`, `d`.`hs_tag_ids` AS `hs_tag_ids`, `d`.`hs_time_in_104175584` AS `hs_time_in_104175584`, `d`.`hs_time_in_104175585` AS `hs_time_in_104175585`, `d`.`hs_time_in_104175586` AS `hs_time_in_104175586`, `d`.`hs_time_in_104175587` AS `hs_time_in_104175587`, `d`.`hs_time_in_104175588` AS `hs_time_in_104175588`, `d`.`hs_time_in_104175589` AS `hs_time_in_104175589`, `d`.`hs_time_in_104175590` AS `hs_time_in_104175590`, `d`.`hs_time_in_109570243` AS `hs_time_in_109570243`, `d`.`hs_time_in_109570257` AS `hs_time_in_109570257`, `d`.`hs_time_in_109570258` AS `hs_time_in_109570258`, `d`.`hs_time_in_109570259` AS `hs_time_in_109570259`, `d`.`hs_time_in_109570260` AS `hs_time_in_109570260`, `d`.`hs_time_in_109570261` AS `hs_time_in_109570261`, `d`.`hs_time_in_109570262` AS `hs_time_in_109570262`, `d`.`hs_time_in_109570263` AS `hs_time_in_109570263`, `d`.`hs_time_in_111070952` AS `hs_time_in_111070952`, `d`.`hs_time_in_113151423` AS `hs_time_in_113151423`, `d`.`hs_time_in_114331579` AS `hs_time_in_114331579`, `d`.`hs_time_in_1555217649` AS `hs_time_in_1555217649`, `d`.`hs_time_in_767120827` AS `hs_time_in_767120827`, `d`.`hs_unique_creation_key` AS `hs_unique_creation_key`, `d`.`hs_user_ids_of_all_notification_followers` AS `hs_user_ids_of_all_notification_followers`, `d`.`hs_v2_cumulative_time_in_104175584` AS `hs_v2_cumulative_time_in_104175584`, `d`.`hs_v2_cumulative_time_in_104175585` AS `hs_v2_cumulative_time_in_104175585`, `d`.`hs_v2_cumulative_time_in_104175586` AS `hs_v2_cumulative_time_in_104175586`, `d`.`hs_v2_cumulative_time_in_104175587` AS `hs_v2_cumulative_time_in_104175587`, `d`.`hs_v2_cumulative_time_in_104175588` AS `hs_v2_cumulative_time_in_104175588`, `d`.`hs_v2_cumulative_time_in_104175589` AS `hs_v2_cumulative_time_in_104175589`, `d`.`hs_v2_cumulative_time_in_104175590` AS `hs_v2_cumulative_time_in_104175590`, `d`.`hs_v2_cumulative_time_in_109570243` AS `hs_v2_cumulative_time_in_109570243`, `d`.`hs_v2_cumulative_time_in_109570258` AS `hs_v2_cumulative_time_in_109570258`, `d`.`hs_v2_cumulative_time_in_109570259` AS `hs_v2_cumulative_time_in_109570259`, `d`.`hs_v2_cumulative_time_in_109570261` AS `hs_v2_cumulative_time_in_109570261`, `d`.`hs_v2_cumulative_time_in_109570262` AS `hs_v2_cumulative_time_in_109570262`, `d`.`hs_v2_cumulative_time_in_109570263` AS `hs_v2_cumulative_time_in_109570263`, `d`.`hs_v2_cumulative_time_in_111070952` AS `hs_v2_cumulative_time_in_111070952`, `d`.`hs_v2_cumulative_time_in_114331579` AS `hs_v2_cumulative_time_in_114331579`, `d`.`hs_v2_cumulative_time_in_1555217649` AS `hs_v2_cumulative_time_in_1555217649`, `d`.`hs_v2_cumulative_time_in_closedlost` AS `hs_v2_cumulative_time_in_closedlost`, `d`.`hs_v2_cumulative_time_in_closedwon` AS `hs_v2_cumulative_time_in_closedwon`, `d`.`hs_v2_cumulative_time_in_contractsent` AS `hs_v2_cumulative_time_in_contractsent`, `d`.`hs_v2_cumulative_time_in_presentationscheduled` AS `hs_v2_cumulative_time_in_presentationscheduled`, `d`.`hs_v2_date_entered_104175584` AS `hs_v2_date_entered_104175584`, `d`.`hs_v2_date_entered_104175585` AS `hs_v2_date_entered_104175585`, `d`.`hs_v2_date_entered_104175588` AS `hs_v2_date_entered_104175588`, `d`.`hs_v2_date_entered_104175589` AS `hs_v2_date_entered_104175589`, `d`.`hs_v2_date_entered_104175590` AS `hs_v2_date_entered_104175590`, `d`.`hs_v2_date_entered_109570259` AS `hs_v2_date_entered_109570259`, `d`.`hs_v2_date_entered_109570261` AS `hs_v2_date_entered_109570261`, `d`.`hs_v2_date_entered_109570263` AS `hs_v2_date_entered_109570263`, `d`.`hs_v2_date_entered_111070952` AS `hs_v2_date_entered_111070952`, `d`.`hs_v2_date_entered_114331579` AS `hs_v2_date_entered_114331579`, `d`.`hs_v2_date_entered_1555217649` AS `hs_v2_date_entered_1555217649`, `d`.`hs_v2_date_entered_presentationscheduled` AS `hs_v2_date_entered_presentationscheduled`, `d`.`hs_v2_date_exited_104175584` AS `hs_v2_date_exited_104175584`, `d`.`hs_v2_date_exited_104175585` AS `hs_v2_date_exited_104175585`, `d`.`hs_v2_date_exited_104175586` AS `hs_v2_date_exited_104175586`, `d`.`hs_v2_date_exited_104175587` AS `hs_v2_date_exited_104175587`, `d`.`hs_v2_date_exited_104175588` AS `hs_v2_date_exited_104175588`, `d`.`hs_v2_date_exited_104175589` AS `hs_v2_date_exited_104175589`, `d`.`hs_v2_date_exited_104175590` AS `hs_v2_date_exited_104175590`, `d`.`hs_v2_date_exited_109570243` AS `hs_v2_date_exited_109570243`, `d`.`hs_v2_date_exited_109570258` AS `hs_v2_date_exited_109570258`, `d`.`hs_v2_date_exited_109570259` AS `hs_v2_date_exited_109570259`, `d`.`hs_v2_date_exited_109570261` AS `hs_v2_date_exited_109570261`, `d`.`hs_v2_date_exited_109570262` AS `hs_v2_date_exited_109570262`, `d`.`hs_v2_date_exited_109570263` AS `hs_v2_date_exited_109570263`, `d`.`hs_v2_date_exited_111070952` AS `hs_v2_date_exited_111070952`, `d`.`hs_v2_date_exited_114331579` AS `hs_v2_date_exited_114331579`, `d`.`hs_v2_date_exited_1555217649` AS `hs_v2_date_exited_1555217649`, `d`.`hs_v2_date_exited_closedlost` AS `hs_v2_date_exited_closedlost`, `d`.`hs_v2_date_exited_closedwon` AS `hs_v2_date_exited_closedwon`, `d`.`hs_v2_date_exited_contractsent` AS `hs_v2_date_exited_contractsent`, `d`.`hs_v2_date_exited_presentationscheduled` AS `hs_v2_date_exited_presentationscheduled`, `d`.`hs_v2_latest_time_in_104175584` AS `hs_v2_latest_time_in_104175584`, `d`.`hs_v2_latest_time_in_104175585` AS `hs_v2_latest_time_in_104175585`, `d`.`hs_v2_latest_time_in_104175586` AS `hs_v2_latest_time_in_104175586`, `d`.`hs_v2_latest_time_in_104175587` AS `hs_v2_latest_time_in_104175587`, `d`.`hs_v2_latest_time_in_104175588` AS `hs_v2_latest_time_in_104175588`, `d`.`hs_v2_latest_time_in_104175589` AS `hs_v2_latest_time_in_104175589`, `d`.`hs_v2_latest_time_in_104175590` AS `hs_v2_latest_time_in_104175590`, `d`.`hs_v2_latest_time_in_109570243` AS `hs_v2_latest_time_in_109570243`, `d`.`hs_v2_latest_time_in_109570258` AS `hs_v2_latest_time_in_109570258`, `d`.`hs_v2_latest_time_in_109570259` AS `hs_v2_latest_time_in_109570259`, `d`.`hs_v2_latest_time_in_109570261` AS `hs_v2_latest_time_in_109570261`, `d`.`hs_v2_latest_time_in_109570262` AS `hs_v2_latest_time_in_109570262`, `d`.`hs_v2_latest_time_in_109570263` AS `hs_v2_latest_time_in_109570263`, `d`.`hs_v2_latest_time_in_111070952` AS `hs_v2_latest_time_in_111070952`, `d`.`hs_v2_latest_time_in_114331579` AS `hs_v2_latest_time_in_114331579`, `d`.`hs_v2_latest_time_in_1555217649` AS `hs_v2_latest_time_in_1555217649`, `d`.`hs_v2_latest_time_in_closedlost` AS `hs_v2_latest_time_in_closedlost`, `d`.`hs_v2_latest_time_in_closedwon` AS `hs_v2_latest_time_in_closedwon`, `d`.`hs_v2_latest_time_in_contractsent` AS `hs_v2_latest_time_in_contractsent`, `d`.`hs_v2_latest_time_in_presentationscheduled` AS `hs_v2_latest_time_in_presentationscheduled`, `d`.`hs_was_imported` AS `hs_was_imported`, `d`.`hs_user_ids_of_all_notification_unfollowers` AS `hs_user_ids_of_all_notification_unfollowers`, `d`.`lead_source` AS `lead_source`, `d`.`hs_average_deal_owner_duration_in_current_stage` AS `hs_average_deal_owner_duration_in_current_stage`, `d`.`adjusted_amount` AS `adjusted_amount`, `e`.`created_at` AS `ext_created_at`, `e`.`updated_at` AS `ext_updated_at` FROM (`hub_deals` `d` left join `hub_deals_ext` `e` on((`d`.`hubspot_deal_id` = `e`.`hubspot_deal_id`))) ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `campaign_geo_targeting`
--
ALTER TABLE `campaign_geo_targeting`
  ADD CONSTRAINT `campaign_geo_targeting_ibfk_1` FOREIGN KEY (`country_code`) REFERENCES `country_rules` (`country_code`);

--
-- Constraints for table `gads_campaign_metrics`
--
ALTER TABLE `gads_campaign_metrics`
  ADD CONSTRAINT `gads_campaign_metrics_ibfk_1` FOREIGN KEY (`google_campaign_id`) REFERENCES `gads_campaigns` (`google_campaign_id`) ON DELETE CASCADE;

--
-- Constraints for table `gads_campaign_status_history`
--
ALTER TABLE `gads_campaign_status_history`
  ADD CONSTRAINT `gads_campaign_status_history_ibfk_1` FOREIGN KEY (`google_campaign_id`) REFERENCES `gads_campaigns` (`google_campaign_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `gads_campaign_status_history_ibfk_2` FOREIGN KEY (`sync_id`) REFERENCES `gads_sync_log` (`sync_id`) ON DELETE SET NULL;

--
-- Constraints for table `gads_geo_targeting`
--
ALTER TABLE `gads_geo_targeting`
  ADD CONSTRAINT `gads_geo_targeting_ibfk_1` FOREIGN KEY (`google_campaign_id`) REFERENCES `gads_campaigns` (`google_campaign_id`) ON DELETE CASCADE;

--
-- Constraints for table `gads_keywords`
--
ALTER TABLE `gads_keywords`
  ADD CONSTRAINT `gads_keywords_ibfk_1` FOREIGN KEY (`google_campaign_id`) REFERENCES `gads_campaigns` (`google_campaign_id`) ON DELETE CASCADE;

--
-- Constraints for table `gads_keyword_metrics`
--
ALTER TABLE `gads_keyword_metrics`
  ADD CONSTRAINT `gads_keyword_metrics_ibfk_1` FOREIGN KEY (`keyword_id`) REFERENCES `gads_keywords` (`keyword_id`) ON DELETE CASCADE;

--
-- Constraints for table `geo_targets`
--
ALTER TABLE `geo_targets`
  ADD CONSTRAINT `geo_targets_ibfk_1` FOREIGN KEY (`country_code`) REFERENCES `country_rules` (`country_code`);

--
-- Constraints for table `hub_contacts`
--
ALTER TABLE `hub_contacts`
  ADD CONSTRAINT `hub_leads_country_fk` FOREIGN KEY (`country_code`) REFERENCES `country_rules` (`country_code`);

--
-- Constraints for table `hub_contacts_ext`
--
ALTER TABLE `hub_contacts_ext`
  ADD CONSTRAINT `hub_contacts_ext_ibfk_1` FOREIGN KEY (`hubspot_id`) REFERENCES `hub_contacts` (`hubspot_id`) ON DELETE CASCADE;

--
-- Constraints for table `hub_contact_deal_associations`
--
ALTER TABLE `hub_contact_deal_associations`
  ADD CONSTRAINT `hub_contact_deal_associations_ibfk_1` FOREIGN KEY (`contact_hubspot_id`) REFERENCES `hub_contacts` (`hubspot_id`),
  ADD CONSTRAINT `hub_contact_deal_associations_ibfk_2` FOREIGN KEY (`deal_hubspot_id`) REFERENCES `hub_deals` (`hubspot_deal_id`);

--
-- Constraints for table `hub_deals`
--
ALTER TABLE `hub_deals`
  ADD CONSTRAINT `hub_deals_stage_fk` FOREIGN KEY (`pipeline_stage`) REFERENCES `pipeline_stages` (`stage_id`);

--
-- Constraints for table `hub_deals_ext`
--
ALTER TABLE `hub_deals_ext`
  ADD CONSTRAINT `hub_deals_ext_ibfk_1` FOREIGN KEY (`hubspot_deal_id`) REFERENCES `hub_deals` (`hubspot_deal_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
