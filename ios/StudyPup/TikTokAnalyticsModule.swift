import Foundation
import TikTokBusinessSDK

@objc(TikTokAnalyticsModule)
class TikTokAnalyticsModule: NSObject {

  @objc func trackEvent(_ eventName: String) {
    let event = TikTokBaseEvent(eventName: eventName)
    TikTokBusiness.trackTTEvent(event)
  }

  @objc func trackPurchase(_ value: String, currency: String, contentId: String, contentName: String) {
    let event: TikTokContentsEvent = TikTokPurchaseEvent()
    event.setValue(value)
    event.setCurrency(TTCurrency(rawValue: currency) ?? TTCurrency.USD)
    event.setContentId(contentId)
    event.setContentName(contentName)
    TikTokBusiness.trackTTEvent(event)
  }

  @objc func identify(_ externalId: String, email: String, phoneNumber: String) {
    TikTokBusiness.identify(
      withExternalID: externalId,
      externalUserName: nil,
      phoneNumber: phoneNumber.isEmpty ? nil : phoneNumber,
      email: email.isEmpty ? nil : email
    )
  }

  @objc func logout() {
    TikTokBusiness.logout()
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
