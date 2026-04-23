#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TikTokAnalyticsModule, NSObject)

RCT_EXTERN_METHOD(trackEvent:(NSString *)eventName)
RCT_EXTERN_METHOD(trackPurchase:(NSString *)value
                  currency:(NSString *)currency
                  contentId:(NSString *)contentId
                  contentName:(NSString *)contentName)
RCT_EXTERN_METHOD(identify:(NSString *)externalId
                  email:(NSString *)email
                  phoneNumber:(NSString *)phoneNumber)
RCT_EXTERN_METHOD(logout)

@end
