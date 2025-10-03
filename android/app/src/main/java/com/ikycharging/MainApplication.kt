package com.ikycharging

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.PackageList

class MainApplication : Application(), ReactApplication {
  override val reactNativeHost: ReactNativeHost =
    object : DefaultReactNativeHost(this) {
      override fun getJSMainModuleName(): String = "index"
      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
      override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      override fun getPackages() = PackageList(this).packages
    }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load(
        BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
        BuildConfig.IS_HERMES_ENABLED
      )
    }
  }
}
