package ch.quartinaut.nativeapp

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.saveable.SaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[34],qualifiers="w390dp-h844dp")
class NativeScrollRestorationTest {
    @get:Rule val compose=createComposeRule()

    @Test fun longPageReturnsToItsPreviousHeightAndRetainsFields() {
        var page by mutableStateOf("settings");lateinit var scroll:ScrollState
        var field=""
        compose.setContent {
            NativeRetainedScreen("account-a",page) {
                if(page=="settings") {
                    scroll=rememberScrollState()
                    var text by rememberSaveable {mutableStateOf("my filter")}
                    field=text
                    Column(Modifier.height(300.dp).verticalScroll(scroll)) {
                        repeat(100){Text("Setting $it",Modifier.height(44.dp))}
                    }
                } else Text("Detail")
            }
        }
        compose.runOnIdle {runBlocking {scroll.scrollTo(1234)}}
        compose.runOnIdle {page="detail"}
        compose.waitForIdle()
        compose.runOnIdle {page="settings"}
        compose.runOnIdle {assertEquals(1234,scroll.value);assertEquals("my filter",field)}
    }

    @Test fun listPositionSurvivesDetailAndActivityStateRestoration() {
        var screen by mutableStateOf("board");lateinit var list:LazyListState
        val restoration=StateRestorationTester(compose)
        restoration.setContent {
            NativeRetainedScreen("account-a",screen) {
                if(screen=="board") {
                    list=rememberLazyListState()
                    LazyColumn(Modifier.height(300.dp).testTag("list"),state=list) {
                        items(200,key={"post-$it"}){Text("Post $it",Modifier.height(48.dp))}
                    }
                } else Text("Post detail")
            }
        }
        compose.onNodeWithTag("list").performScrollToIndex(65)
        compose.runOnIdle {assertEquals(65,list.firstVisibleItemIndex);screen="detail"}
        compose.waitForIdle();restoration.emulateSavedInstanceStateRestore()
        compose.runOnIdle {screen="board"}
        compose.runOnIdle {assertEquals(65,list.firstVisibleItemIndex)}
    }

    @Test fun differentScreensAndAccountsHaveIndependentPositions() {
        var account by mutableStateOf("account-a");var page by mutableStateOf("home")
        lateinit var scroll:ScrollState
        compose.setContent {
            NativeRetainedScreen(account,page) {
                scroll=rememberScrollState()
                Column(Modifier.height(300.dp).verticalScroll(scroll)) {
                    repeat(100){Text("Row $it",Modifier.height(44.dp))}
                }
            }
        }
        compose.runOnIdle {runBlocking{scroll.scrollTo(1100)};page="profile"}
        compose.runOnIdle {assertEquals(0,scroll.value);runBlocking{scroll.scrollTo(550)};page="home"}
        compose.runOnIdle {assertEquals(1100,scroll.value);account="account-b"}
        compose.runOnIdle {assertEquals(0,scroll.value)}
    }
    @Test fun completedFormsAreForgottenWhileTheMenuPositionIsRetained() {
        var page by mutableStateOf("menu");lateinit var memory:SaveableStateHolder
        lateinit var scroll:ScrollState
        compose.setContent {
            memory=rememberSaveableStateHolder()
            NativeRetainedScreen("account-a",page,memory) {
                scroll=rememberScrollState()
                Column(Modifier.height(300.dp).verticalScroll(scroll)) {
                    repeat(100){Text("Row $it",Modifier.height(44.dp))}
                }
            }
        }
        compose.runOnIdle {runBlocking{scroll.scrollTo(900)};page="create-request"}
        compose.runOnIdle {runBlocking{scroll.scrollTo(600)};memory.removeState("create-request");page="menu"}
        compose.runOnIdle {assertEquals(900,scroll.value);page="create-request"}
        compose.runOnIdle {assertEquals(0,scroll.value)}
    }

}
