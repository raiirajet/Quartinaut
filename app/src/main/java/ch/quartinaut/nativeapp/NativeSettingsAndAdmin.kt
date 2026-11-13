package ch.quartinaut.nativeapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat

private val HomeLabels = linkedMapOf(
    "home" to "Übersicht", "hub" to "Quartier+",
    "bulletin" to "Schwarzes Brett", "events" to "Gemeindetermine",
    "inbox" to "Mitteilungen", "chats" to "Chats"
)
private val Topics = linkedMapOf(
    "chats" to "Private Chats","alerts" to "Gemeinde-Alarme",
    "help" to "Nachbarschaftshilfe","events" to "Veranstaltungen",
    "groups" to "Vereine & Gruppen","market" to "Marktplatz",
    "lending" to "Ausleihen","municipality" to "Gemeindenachrichten"
)

@Composable
fun NativeSettingsScreen(repo: QuartinautRepository,dark: Boolean,
                         updateDark: (Boolean) -> Unit, navigate: (String) -> Unit) {
    val context=LocalContext.current
    val notificationPermission=rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if(granted)repo.enablePush()
        else repo.showMessage("Ohne Benachrichtigungsfreigabe kann Android keine Pushmeldungen anzeigen.")
    }
    LaunchedEffect(repo.user?.uid) { repo.loadCommunitySettings() }
    val saved=repo.communitySettings
    var home by remember { mutableStateOf("home") }
    var digest by remember { mutableStateOf("off") }
    var quiet by remember { mutableStateOf(false) }
    val topics=remember { mutableStateListOf("chats","alerts","help") }
    LaunchedEffect(saved) {
        home=DocString(saved["homeView"]).ifBlank{"home"}
        digest=DocString(saved["digest"]).ifBlank{"off"}
        quiet=saved["quietHours"] == true
        val savedTopics=(saved["topics"] as? List<*>)?.filterIsInstance<String>()
        if(savedTopics!=null) {topics.clear();topics.addAll(savedTopics)}
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(13.dp)) {
        Text("Einstellungen",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Darstellung",style=MaterialTheme.typography.titleMedium)
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,
            verticalAlignment=Alignment.CenterVertically) {
            Column {
                Text("Dunkles Design",fontWeight=FontWeight.Medium)
                Text("Auch für den ganzen Android-Bildschirm",style=MaterialTheme.typography.bodySmall)
            }
            Switch(dark,onCheckedChange=updateDark)
        }
        HorizontalDivider()
        NativeDashboardBackgroundSettings(repo)
        HorizontalDivider()
        Text("Meine Startseite",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
        HomeLabels.forEach { (key,label) ->
            Row(Modifier.fillMaxWidth().clickable {home=key},verticalAlignment=Alignment.CenterVertically) {
                RadioButton(selected=home==key,onClick={home=key})
                Text(label)
            }
        }
        HorizontalDivider()
        Text("Benachrichtigungsthemen",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
        Topics.forEach { (key,label) ->
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                Checkbox(checked=key in topics,onCheckedChange={checked->
                    if(checked) { if(key !in topics)topics.add(key) }
                    else topics.remove(key)
                })
                Text(label)
            }
        }
        Text("Zusammenfassung",fontWeight=FontWeight.SemiBold)
        listOf("off" to "Keine","daily" to "Täglich","weekly" to "Wöchentlich").forEach { (key,label) ->
            Row(verticalAlignment=Alignment.CenterVertically) {
                RadioButton(selected=digest==key,onClick={digest=key})
                Text(label)
            }
        }
        Row(verticalAlignment=Alignment.CenterVertically) {
            Switch(checked=quiet,onCheckedChange={quiet=it})
            Spacer(Modifier.width(12.dp))
            Text("Ruhezeiten berücksichtigen")
        }
        Button(onClick={
            repo.saveCommunitySettings(mapOf(
                "homeView" to home,"topics" to topics.toList(),
                "digest" to digest,"quietHours" to quiet))
        },enabled=!repo.busy,modifier=Modifier.fillMaxWidth()) {Text("Einstellungen speichern")}
        OutlinedButton(onClick={
            if(Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(
                    context,Manifest.permission.POST_NOTIFICATIONS
                )==PackageManager.PERMISSION_GRANTED
            ) repo.enablePush()
            else notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        },enabled=!repo.busy,modifier=Modifier.fillMaxWidth()) {
            Text("Pushmeldungen auf diesem Gerät aktivieren")
        }
        Text("Die Freigabe gilt nur für dieses Gerät und kann in Android jederzeit widerrufen werden.",
            style=MaterialTheme.typography.bodySmall)
        TextButton(on…65608 tokens truncated…3.6.0",
      "resolved": "https://registry.npmjs.org/import-in-the-middle/-/import-in-the-middle-3.6.0.tgz",
      "integrity": "sha512-xRU7hI24S2FhucXtuZXn8EpcOjfVP6iiEQyR0USayPeaOroEmSsNlqnl95866iRdRtkHrd6Q/Z4D14R60au0+A==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "cjs-module-lexer": "^2.2.0",
        "es-module-lexer": "^3.0.4",
        "module-details-from-path": "^1.0.4"
      },
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/is-fullwidth-code-point": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/is-fullwidth-code-point/-/is-fullwidth-code-point-3.0.0.tgz",
      "integrity": "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/lodash.camelcase": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/lodash.camelcase/-/lodash.camelcase-4.3.0.tgz",
      "integrity": "sha512-TwuEnCnxbc3rAvhf/LbG7tJUDzhqXyFnv3dtzLOPgCG/hODL7WFnsbwktkD7yUV0RrreP/l1PALq/YSg6VvjlA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/long": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/long/-/long-5.3.2.tgz",
      "integrity": "sha512-mNAgZ1GmyNhD7AuqnTG3/VQ26o760+ZYBPKjPvugO8+nLbYfX6TVpJPseBvopbdY+qpZ/lKUnmEc1LeZYS3QAA==",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/module-details-from-path": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/module-details-from-path/-/module-details-from-path-1.0.4.tgz",
      "integrity": "sha512-EGWKgxALGMgzvxYF1UyGTy0HXX/2vHLkw6+NvDKW2jypWbHpjQuj4UMcqQWXHERJhVGKikolT06G3bcKe4fi7w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/protobufjs": {
      "version": "7.6.6",
      "resolved": "https://registry.npmjs.org/protobufjs/-/protobufjs-7.6.6.tgz",
      "integrity": "sha512-dYDWdjSl5RNb7SgPxGQcRU+GtvP7s2fpkrY0r432PcOIaZ0/rBcxEZnQN67iJhFuQiVw754JDoPruPCNdGsbjg==",
      "dev": true,
      "hasInstallScript": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "@protobufjs/aspromise": "^1.1.2",
        "@protobufjs/base64": "^1.1.2",
        "@protobufjs/codegen": "^2.0.5",
        "@protobufjs/eventemitter": "^1.1.1",
        "@protobufjs/fetch": "^1.1.1",
        "@protobufjs/float": "^1.0.2",
        "@protobufjs/path": "^1.1.2",
        "@protobufjs/pool": "^1.1.0",
        "@protobufjs/utf8": "^1.1.1",
        "@types/node": ">=13.7.0",
        "long": "^5.3.2"
      },
      "engines": {
        "node": ">=12.0.0"
      }
    },
    "node_modules/re2js": {
      "version": "2.10.0",
      "resolved": "https://registry.npmjs.org/re2js/-/re2js-2.10.0.tgz",
      "integrity": "sha512-/P6FNnLbHjXJMRF1dPoZoVTyHvFcuVhbDpzml9DPMlbeErYlZ18GueAaG9GhYhAm/9AN7i7Y6crmDrLX0DeJ4Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=20.0.0"
      }
    },
    "node_modules/require-directory": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/require-directory/-/require-directory-2.1.1.tgz",
      "integrity": "sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/require-in-the-middle": {
      "version": "8.0.1",
      "resolved": "https://registry.npmjs.org/require-in-the-middle/-/require-in-the-middle-8.0.1.tgz",
      "integrity": "sha512-QT7FVMXfWOYFbeRBF6nu+I6tr2Tf3u0q8RIEjNob/heKY/nh7drD/k7eeMFmSQgnTtCzLDcCu/XEnpW2wk4xCQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "debug": "^4.3.5",
        "module-details-from-path": "^1.0.3"
      },
      "engines": {
        "node": ">=9.3.0 || >=8.10.0 <9.0.0"
      }
    },
    "node_modules/safe-buffer": {
      "version": "5.2.1",
      "resolved": "https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.2.1.tgz",
      "integrity": "sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/string-width": {
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "emoji-regex": "^8.0.0",
        "is-fullwidth-code-point": "^3.0.0",
        "strip-ansi": "^6.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/tslib": {
      "version": "2.9.1",
      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.9.1.tgz",
      "integrity": "sha512-a4Ux9VKuIMHsOS7ENbEq6hK2ZGYIT27Rtl0E4eD9KqwxhKiQeMZE/9xb3IdYwWaSOyIBQLExhQgXDTYoiCxnWA==",
      "dev": true,
      "license": "0BSD"
    },
    "node_modules/undici-types": {
      "version": "8.9.0",
      "resolved": "https://registry.npmjs.org/undici-types/-/undici-types-8.9.0.tgz",
      "integrity": "sha512-KTDyRTYX8sWmKXAikPHHSyc63CRPETMctyjKFupcC6OBLXT3xsN0e9aF7m+mIXutFWpUXuedtowG7iLOzp0kQg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/web-vitals": {
      "version": "4.2.4",
      "resolved": "https://registry.npmjs.org/web-vitals/-/web-vitals-4.2.4.tgz",
      "integrity": "sha512-r4DIlprAGwJ7YM11VZp4R884m0Vmgr6EAKe3P+kO0PPj3Unqyvv59rczf6UiGcb9Z8QxZVcqKNwv/g0WNdWwsw==",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/websocket-driver": {
      "version": "0.7.5",
      "resolved": "https://registry.npmjs.org/websocket-driver/-/websocket-driver-0.7.5.tgz",
      "integrity": "sha512-ZL2+3c7kMBdIRCMz6l8jQMHyGVxj+UL+xVk74Ombiciboca8rHa15L86B19E5oh1pL9Ii/uj54gtsIrZGMo6zA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "http-parser-js": ">=0.5.1",
        "safe-buffer": ">=5.1.0",
        "websocket-extensions": ">=0.1.1"
      },
      "engines": {
        "node": ">=0.8.0"
      }
    },
    "node_modules/websocket-extensions": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/websocket-extensions/-/websocket-extensions-0.1.4.tgz",
      "integrity": "sha512-OqedPIGOfsDlo31UNwYbCFMSaO9m9G/0faIHj5/dZFDMFqPTcx6UwqyOy3COEaEOg/9VsGIpdqn62W5KhoKSpg==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=0.8.0"
      }
    },
    "node_modules/wrap-ansi": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-7.0.0.tgz",
      "integrity": "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.0.0",
        "string-width": "^4.1.0",
        "strip-ansi": "^6.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/wrap-ansi?sponsor=1"
      }
    },
    "node_modules/y18n": {
      "version": "5.0.8",
      "resolved": "https://registry.npmjs.org/y18n/-/y18n-5.0.8.tgz",
      "integrity": "sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/yargs": {
      "version": "17.7.3",
      "resolved": "https://registry.npmjs.org/yargs/-/yargs-17.7.3.tgz",
      "integrity": "sha512-GZtjxm/J/4TSxuL3FNYjCmLktBTnIw/rVmKSIyKeYAZpmJB2ig9VauCC5xsa82GNKVKDAqpOn3KVzNt0zmrU0g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cliui": "^8.0.1",
        "escalade": "^3.1.1",
        "get-caller-file": "^2.0.5",
        "require-directory": "^2.1.1",
        "string-width": "^4.2.3",
        "y18n": "^5.0.5",
        "yargs-parser": "^21.1.1"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/yargs-parser": {
      "version": "21.1.1",
      "resolved": "https://registry.npmjs.org/yargs-parser/-/yargs-parser-21.1.1.tgz",
      "integrity": "sha512-tVpsJW7DdjecAiFpbIB1e3qxIQsE6NoPc5/eTdrbbIC4h0LVsWhnoa3g+m2HclBIujHzsxZ4VJVA+GUuc2/LBw==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    }
  }
}
