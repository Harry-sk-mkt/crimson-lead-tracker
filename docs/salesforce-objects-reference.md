# Salesforce Objects Reference

> 2026-07-21 대화 중 공유된 조직 전체 Salesforce Object 목록.
> ACQ Report / SAL 데이터 설계 참고용 (실제 CSV 컬럼 목록이 아니라 Object 스키마 레벨 정보).

## 이 프로젝트와 관련 있어 보이는 Object (참고)

- **Lead** (`Lead`, Standard Object) — Leads_Raw/Leads_Master의 소스로 추정
- **Multi Touch Attribution** (`Multi_Touch_Attribution__c`, Custom Object, 2021-09-26 배포) — MTA_Raw/MTA_Master의 소스로 추정. 터치 단위 레코드를 담는 Object로 보임 — SAL 판별 필드가 이미 여기 있을 가능성 있음 (확인 필요).
- **Opportunity** (`Opportunity`, Standard Object) — Revenue/Won Date 관련
- **UTM Medium** (`UTM_Medium__c`) — Lead Source ↔ UTM 매핑 관리용
- **Campaign / Campaign Member** — MKT UTM Campaign 관련 가능성

## 전체 Object 목록 (원본 그대로)

| Label | API Name | Type | Description | Last Modified | Deployed |
|---|---|---|---|---|---|
| Account | Account | Standard Object | | | False |
| Account Brand | AccountBrand | Standard Object | | | False |
| Account Contact Relationship | AccountContactRelation | Standard Object | | | False |
| Account Team Member | AccountTeamMember | Standard Object | | | False |
| Action Plan | ActionPlan | Standard Object | | | False |
| Activity | Activity | Standard Object | | | False |
| Activity History | DevopsActivityLog | Standard Object | | | False |
| Address | Address | Standard Object | | | False |
| Alert | Alert__c | Custom Object | | 16/4/2019 | True |
| Alert Type | Alert_Type__c | Custom Object | | 16/4/2019 | True |
| Alternative Payment Method | AlternativePaymentMethod | Standard Object | | | False |
| Answer | GetFeedback_Aut__Answer__c | Custom Object | | 21/1/2019 | True |
| Approval Submission | ApprovalSubmission | Standard Object | | | False |
| Approval Submission Detail | ApprovalSubmissionDetail | Standard Object | | | False |
| Approval Work Item | ApprovalWorkItem | Standard Object | | | False |
| Asset | Asset | Standard Object | | | False |
| Asset Relationship | AssetRelationship | Standard Object | | | False |
| Associated Location | AssociatedLocation | Standard Object | | | False |
| Authorization Form | AuthorizationForm | Standard Object | | | False |
| Authorization Form Consent | AuthorizationFormConsent | Standard Object | | | False |
| Authorization Form Data Use | AuthorizationFormDataUse | Standard Object | | | False |
| Authorization Form Text | AuthorizationFormText | Standard Object | | | False |
| Best Bets View | mkto_si__Best_Bets_View__c | Custom Object | | 6/8/2021 | True |
| Best Bets View Detail | mkto_si__Best_Bets_View_Detail__c | Custom Object | | 6/8/2021 | True |
| BestBetsCache | mkto_si__BestBetsCache__c | Custom Object | | 6/8/2021 | True |
| Block List | DaScoopComposer__Black_List__c | Custom Object | Email addresses and domains that users wish to be ignored by Groove | 10/11/2023 | True |
| Broadcast Topic | BroadcastTopic | Standard Object | | | False |
| Business Brand | BusinessBrand | Standard Object | | | False |
| Calculated Insight Range Bound | CalculatedInsightRangeBound | Standard Object | | | False |
| CalendlyAction | Calendly__CalendlyAction__c | Custom Object | | 1/7/2026 | True |
| CalendlyExternalEvent | Calendly__CalendlyExternalEvent__c | Custom Object | An event that was scheduled from the Calendly user's connected calendar. | 1/7/2026 | True |
| CalendlyLink | Calendly__CalendlyLink__c | Custom Object | | 1/7/2026 | True |
| CalendlyMeetingRecap | Calendly__CalendlyMeetingRecap__c | Custom Object | | 1/7/2026 | True |
| CalendlyRoutingFormQuestionsAnswers | Calendly__CalendlyRoutingFormQuestionsAnswers__c | Custom Object | | 1/7/2026 | True |
| CalendlyRoutingFormSubmission | Calendly__CalendlyRoutingFormSubmission__c | Custom Object | | 1/7/2026 | True |
| Campaign | Campaign | Standard Object | | | False |
| Campaign Influence | CampaignInfluence | Standard Object | | | False |
| Campaign Member | CampaignMember | Standard Object | | | False |
| Campaign Member Status Default Value | AAKCS__Campaign_Status_Default_Value__c | Custom Object | | 17/8/2018 | True |
| Campaign Status Default | AAKCS__Campaign_Status_Default__c | Custom Object | Object stores related campaign status's that will default campaign status's based on Campaign Type. | 17/8/2018 | True |
| Campaign Status Error Log | AAKCS__Error_Log__c | Custom Object | Should any system errors be detected, then they will be logged here. Workflows will alert system administrators of these errors for actioning. | 17/8/2018 | True |
| Card Payment Method | CardPaymentMethod | Standard Object | | | False |
| Case | Case | Standard Object | | | False |
| Channel Program | ChannelProgram | Standard Object | | | False |
| Channel Program Level | ChannelProgramLevel | Standard Object | | | False |
| Channel Program Member | ChannelProgramMember | Standard Object | | | False |
| Collaboration Room | CollaborationRoom | Standard Object | | | False |
| Communication Subscription | CommSubscription | Standard Object | | | False |
| Communication Subscription Channel Type | CommSubscriptionChannelType | Standard Object | | | False |
| Communication Subscription Consent | CommSubscriptionConsent | Standard Object | | | False |
| Communication Subscription Timing | CommSubscriptionTiming | Standard Object | | | False |
| Consultation | Consultation__c | Custom Object | | 29/4/2019 | True |
| Contact | Contact | Standard Object | | | False |
| Contact Point Address | ContactPointAddress | Standard Object | | | False |
| Contact Point Consent | ContactPointConsent | Standard Object | | | False |
| Contact Point Email | ContactPointEmail | Standard Object | | | False |
| Contact Point Phone | ContactPointPhone | Standard Object | | | False |
| Contact Point Type Consent | ContactPointTypeConsent | Standard Object | | | False |
| Contact Re-Engagement | Contact_Re_Engagement__c | Custom Object | | 14/9/2023 | True |
| Contact Request | ContactRequest | Standard Object | | | False |
| Content Version | ContentVersion | Standard Object | | | False |
| Contract | Contract | Standard Object | | | False |
| Conversation | DaScoopComposer__Conversation__c | Custom Object | | 8/2/2025 | True |
| Conversation Account | DaScoopComposer__ConversationAccount__c | Custom Object | | 8/2/2025 | True |
| Conversation Lead | DaScoopComposer__ConversationLead__c | Custom Object | | 8/2/2025 | True |
| Conversation Opportunity | DaScoopComposer__ConversationOpportunity__c | Custom Object | | 8/2/2025 | True |
| Credit Memo | CreditMemo | Standard Object | | | False |
| Credit Memo Invoice Application | CreditMemoInvApplication | Standard Object | | | False |
| Credit Memo Line | CreditMemoLine | Standard Object | | | False |
| Customer | Customer | Standard Object | | | False |
| Data Kit Deployment Log | DataKitDeploymentLog | Standard Object | | | False |
| Data Use Legal Basis | DataUseLegalBasis | Standard Object | | | False |
| Data Use Purpose | DataUsePurpose | Standard Object | | | False |
| Digital Wallet | DigitalWallet | Standard Object | | | False |
| Discount | Discount__c | Custom Object | Discount strategy to apply to a Price Book Entry | 19/12/2018 | True |
| Discount Band | Discount_Band__c | Custom Object | A Band of Discount, has matching criteria, and a discount to apply if those criteria match | 19/12/2018 | True |
| Division Survey Link | Division_Survey_Link__c | Custom Object | Maps base GetFeedback Survey Links to Divisions | 15/9/2021 | True |
| Doc Status | pandadoc__DocStatus__c | Custom Object | | 6/9/2017 | True |
| Domain Block List | DaScoopComposer__Domain_Block_List__c | Custom Object | Domain Block List Custom Object | 8/2/2025 | True |
| Duplicate Record Item | DuplicateRecordItem | Standard Object | | | False |
| Duplicate Record Set | DuplicateRecordSet | Standard Object | | | False |
| Email Message | EmailMessage | Standard Object | | | False |
| EmailActivityCache | mkto_si__EmailActivityCache__c | Custom Object | | 6/8/2021 | True |
| Employee | Employee | Standard Object | | | False |
| Engagement Channel Type | EngagementChannelType | Standard Object | | | False |
| ers_datatableConfig | ers_datatableConfig__c | Custom Object | Store attributes for the Column Wizard Flow that is part of the Datatable CPE | 28/10/2024 | True |
| Event | Event | Standard Object | | | False |
| External Managed Account | DelegatedAccount | Standard Object | | | False |
| Field Analysis | Field_Trip__Field_Analysis__c | Custom Object | | 4/5/2018 | True |
| Field Trip | Field_Trip__Object_Analysis__c | Custom Object | | 4/5/2018 | True |
| Flow Personal Configuration | FlowPersonalConfiguration__c | Custom Object | | 28/10/2024 | True |
| FlowTableViewDefinition | FlowTableViewDefinition__c | Custom Object | Store attributes for the Column Wizard Flow that is part of the Datatable CPE | 28/10/2024 | True |
| Forecasting Custom Data | ForecastingCustomData | Standard Object | | | False |
| GetMethodArgu | mkto_si__Get_Method_Argus__c | Custom Object | | 6/8/2021 | True |
| Goal Assignment | GoalAssignment | Standard Object | | | False |
| Goal Definition | GoalDefinition | Standard Object | | | False |
| Google Doc | Google_Doc__c | Custom Object | | 6/3/2020 | True |
| Groove View | DaScoopComposer__DaScoop_Snippet__c | Custom Object | | 8/2/2025 | True |
| GroupedWebActivityCache | mkto_si__GroupedWebActivityCache__c | Custom Object | | 6/8/2021 | True |
| ICF Detail | ICF_Detail__c | Custom Object | | 10/12/2025 | True |
| Image | Image | Standard Object | | | False |
| Individual | Individual | Standard Object | | | False |
| Installment | Installment__c | Custom Object | | 3/2/2021 | True |
| InterestingMomentsCache | mkto_si__InterestingMomentsCache__c | Custom Object | | 6/8/2021 | True |
| Internal Organization Unit | InternalOrganizationUnit | Standard Object | | | False |
| Invoice | Invoice | Standard Object | | | False |
| Invoice Address Group | InvoiceAddressGroup | Standard Object | | | False |
| Invoice Document | InvoiceDocument | Standard Object | | | False |
| Invoice Line | InvoiceLine | Standard Object | | | False |
| Lead | Lead | Standard Object | | | False |
| Lead Match | DaScoopComposer__Lead_Match__c | Custom Object | Matches Leads and Accounts in a many-to-many relationship | 8/2/2025 | True |
| Learning Item | LearningItem | Standard Object | | | False |
| List Email | ListEmail | Standard Object | | | False |
| Location | Location | Standard Object | | | False |
| Location Trust Measure | LocationTrustMeasure | Standard Object | | | False |
| Lookup Child | dlrs__LookupChild__c | Custom Object | | 5/4/2020 | True |
| Lookup Child Big | dlrs__LookupChildAReallyReallyReallyBigBigName__c | Custom Object | | 5/4/2020 | True |
| Lookup Parent | dlrs__LookupParent__c | Custom Object | | 5/4/2020 | True |
| Lookup Rollup Calculate Job | dlrs__LookupRollupCalculateJob__c | Custom Object | | 5/4/2020 | True |
| Lookup Rollup Summary | dlrs__LookupRollupSummary__c | Custom Object | | 5/4/2020 | True |
| Lookup Rollup Summary Log | dlrs__LookupRollupSummaryLog__c | Custom Object | | 5/4/2020 | True |
| Lookup Rollup Summary Schedule Item | dlrs__LookupRollupSummaryScheduleItems__c | Custom Object | | 8/3/2021 | True |
| Macro | Macro | Standard Object | | | False |
| Marketo Sales Insight Config | mkto_si__Marketo_Sales_Insight_Config__c | Custom Object | | 6/8/2021 | True |
| Mass Action Configuration | dca_mass_action__Mass_Action_Configuration__c | Custom Object | A configuration of inputs (reports, list views, queries) and actions (process builder, flows, apex) that can be scheduled. | 15/4/2019 | True |
| Mass Action Log | dca_mass_action__Mass_Action_Log__c | Custom Object | Information about Mass Action executions. | 15/4/2019 | True |
| Mass Action Mapping | dca_mass_action__Mass_Action_Mapping__c | Custom Object | Defines field mappings between sources and targets. | 15/4/2019 | True |
| Messaging Session | MessagingSession | Standard Object | | | False |
| Messaging User | MessagingEndUser | Standard Object | | | False |
| Multi Touch Attribution | Multi_Touch_Attribution__c | Custom Object | | 26/9/2021 | True |
| Notification | Notification__c | Custom Object | | 16/4/2019 | True |
| NPS Survey | Survey_Response__c | Custom Object | This object holds the information on NPS survey responses from GetFeedback | 24/5/2019 | True |
| Object Tokens | pandadoc__Object_Tokens__c | Custom Object | | 19/5/2020 | True |
| Operating Hours | OperatingHours | Standard Object | | | False |
| Operating Hours Holiday | OperatingHoursHoliday | Standard Object | | | False |
| Opportunity | Opportunity | Standard Object | | | False |
| Opportunity Contact Role | OpportunityContactRole | Standard Object | | | False |
| Opportunity Product Split | OpportunityLineItemSplit | Standard Object | | | False |
| Opportunity Service | OpportunityLineItem | Standard Object | | | False |
| Opportunity Split | OpportunitySplit | Standard Object | | | False |
| Opportunity Team Member | OpportunityTeamMember | Standard Object | | | False |
| Orchestration Run | FlowOrchestrationInstance | Standard Object | | | False |
| Orchestration Run Log | FlowOrchestrationLog | Standard Object | | | False |
| Orchestration Stage Run | FlowOrchestrationStageInstance | Standard Object | | | False |
| Orchestration Step Run | FlowOrchestrationStepInstance | Standard Object | | | False |
| Orchestration Work Item | FlowOrchestrationWorkItem | Standard Object | | | False |
| Order | Order | Standard Object | | | False |
| Order Product | OrderItem | Standard Object | | | False |
| PandaDoc Document | pandadoc__PandaDocDocument__c | Custom Object | | 6/9/2017 | True |
| PandaDoc Log | pandadoc__PandaDocLog__c | Custom Object | | 19/5/2020 | True |
| Partner Offer Item | SfdcPartnerSbscrOfferItem | Standard Object | | | False |
| Partner Subscriber Offer | SfdcPartnerSbscrOffer | Standard Object | | | False |
| Party Consent | PartyConsent | Standard Object | | | False |
| Payment | Payment__c | Custom Object | | 12/4/2020 | True |
| Payment | Payment | Standard Object | | | False |
| Payment Authorization | PaymentAuthorization | Standard Object | | | False |
| Payment Authorization Adjustment | PaymentAuthAdjustment | Standard Object | | | False |
| Payment Gateway | PaymentGateway | Standard Object | | | False |
| Payment Group | PaymentGroup | Standard Object | | | False |
| Payment Line Invoice | PaymentLineInvoice | Standard Object | | | False |
| Price Book | Pricebook2 | Standard Object | | | False |
| Price Book Entry | PricebookEntry | Standard Object | | | False |
| Pricing Item Map | pandadoc__Pricing_Item_Mapping__c | Custom Object | | 19/5/2020 | True |
| Process Exception | ProcessException | Standard Object | | | False |
| Program Element | Program_Element__c | Custom Object | | 1/7/2021 | True |
| Query Editor | DataQueryWorkspace | Standard Object | | | False |
| Quick Text | QuickText | Standard Object | | | False |
| Quote | Quote | Standard Object | | | False |
| Quote Line Item | QuoteLineItem | Standard Object | | | False |
| Recipient | DaScoopComposer__Recipient__c | Custom Object | | 8/2/2025 | True |
| Recipient Map | pandadoc__Recipient_Map__c | Custom Object | | 19/5/2020 | True |
| Recommendation | Recommendation | Standard Object | | | False |
| Record Collection | SharingRecordCollection | Standard Object | | | False |
| Refund | Refund | Standard Object | | | False |
| Refund Line Payment | RefundLinePayment | Standard Object | | | False |
| Region Mapping | Region_Mapping__c | Custom Object | | 24/8/2021 | True |
| Response | GetFeedback_Aut__Response__c | Custom Object | | 21/1/2019 | True |
| School | School__c | Custom Object | | 27/2/2020 | True |
| Scorecard | Scorecard | Standard Object | | | False |
| Scorecard Association | ScorecardAssociation | Standard Object | | | False |
| Scorecard Metric | ScorecardMetric | Standard Object | | | False |
| ScoringCache | mkto_si__ScoringCache__c | Custom Object | | 6/8/2021 | True |
| Secondary Lead | Secondary_Lead__c | Custom Object | Used in Eventbrite integration. Eventbrite's model is Orders and Attendees. What we do is create a Lead for each Order, and a Secondary Lead object for each of the Attendees, and then there is a "Promote to Lead" button which creates a Lead from a Secondary Lead. | 1/4/2020 | True |
| Secondary Lead Relation | Secondary_Lead_Relation__c | Custom Object | Relationship between leads and secondary leads | 16/9/2019 | True |
| Seller | Seller | Standard Object | | | False |
| Service | Product2 | Standard Object | | | False |
| Service Catalog Request | SvcCatalogRequest | Standard Object | | | False |
| Service Catalog Request Related Item | SvcCatalogReqRelatedItem | Standard Object | | | False |
| Social Persona | SocialPersona | Standard Object | | | False |
| Student Success Manager | SSM__c | Custom Object | | 12/6/2023 | True |
| Survey | GetFeedback_Aut__Survey__c | Custom Object | | 21/1/2019 | True |
| Survey Invitation | SurveyInvitation | Standard Object | | | False |
| Survey Response | Survey_Responses__c | Custom Object | This object holds the information on survey responses | 21/6/2019 | True |
| Survey Subject | SurveySubject | Standard Object | | | False |
| Swarm | Swarm | Standard Object | | | False |
| Task | Task | Standard Object | | | False |
| Tax Rate | Tax_Rate__c | Custom Object | | 19/12/2018 | True |
| Tax Treatment | TaxTreatment | Standard Object | | | False |
| Test_Lead | TestLead__c | Custom Object | | 28/9/2021 | True |
| Tier Price | Tier_Price__c | Custom Object | Holds the different prices for different amounts of purchased product | 13/9/2018 | True |
| Time Metric | Time_Metric__c | Custom Object | | 19/12/2018 | True |
| Time Slot | TimeSlot | Standard Object | | | False |
| Tracked Message | DaScoopComposer__Tracked_Message__c | Custom Object | | 8/2/2025 | True |
| Tracked Message Event | DaScoopComposer__Tracked_Message_Event__c | Custom Object | | 8/2/2025 | True |
| Trigger Setting | pandadoc__TriggerSetting__c | Custom Object | | 6/9/2017 | True |
| UnstructuredStorageSpace | UnstructuredStorageSpace | Standard Object | | | False |
| User | User | Standard Object | | | False |
| User Provisioning Request | UserProvisioningRequest | Standard Object | | | False |
| Utilization Alert | TenantConsumptionAlert | Standard Object | | | False |
| UTM Medium | UTM_Medium__c | Custom Object | Used to map and keep track of "Lead Source" and "Lead Source Category" against each UTM Medium. Both the Lead object and the "Multi Touch Attribution" object look up to "UTM Medium" object. Gives Crimson one place where they can maintain Lead Source info against each UTM Medium parameter. | 12/12/2023 | True |
| Value | mkto_si__Value__c | Custom Object | | 6/8/2021 | True |
| Video Call | VideoCall | Standard Object | | | False |
| Video Call Participant | VideoCallParticipant | Standard Object | | | False |
| Voice Call | VoiceCall | Standard Object | | | False |
| WebActivityCache | mkto_si__WebActivityCache__c | Custom Object | | 6/8/2021 | True |
| XE Data Record | XE_Connector__XE_Data__c | Custom Object | | 19/11/2019 | True |
| Zoom | zoom_app__Zoom__c | Custom Object | This object saves the API configuration details of Salesforce and Zoom integration. It will have only one record per ORG. API details will be used of Zoom Admin account. Zoom users of admin account will be different users in Salesforce. | 10/7/2020 | True |
| Zoom Call Log | zoom_app__Zoom_Call_Log__c | Custom Object | | 10/7/2020 | True |
| Zoom Event | zoom_app__Zoom_Event__c | Custom Object | This object is the extension to "Event" object. It saves all zoom meeting info. | 10/7/2020 | True |
| Zoom Voice User | zoom_app__Zoom_Voice_User__c | Custom Object | | 10/7/2020 | True |
| Zoom Webinar | zoom_app__Zoom_Webinar__c | Custom Object | present a Webinar on Zoom Side | 10/7/2020 | True |
| Zoom Webinar Attendee | zoom_app__Zoom_Webinar_Attendee__c | Custom Object | | 10/7/2020 | True |
| Zoom Webinar Config | zoom_app__Zoom_Webinar_Config__c | Custom Object | | 10/7/2020 | True |
| Zoom Webinar History | zoom_app__Zoom_Webinar_History__c | Custom Object | | 10/7/2020 | True |
| Zoom Webinar Panelist | zoom_app__Zoom_Webinar_Panelist__c | Custom Object | | 10/7/2020 | True |
| Zoom Webinar Registrant | zoom_app__Zoom_Webinar_Registrant__c | Custom Object | | 10/7/2020 | True |