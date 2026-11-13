package ch.quartinaut.nativeapp

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp

private val CreateCategories=listOf("Alltagshilfe","Kinder","Werkzeug","Mobilität",
    "Tiere","Information","Notfall","Gesundheit","Seniorenhilfe","Digitalhilfe",
    "Wohnen","Bildung","Nachhaltigkeit","Firmen / Arbeit")
private val UrgencyLabels=listOf("Heute","Morgen","Diese Woche","Nicht dringend")
private val CreatePane=Color(0xFF1C342A)
private val CreateBorder=Color(0xFF416B55)
private val CreateText=Color(0xFFDBEBDD)
private val CreateAccent=Color(0xFF9FE0B5)

@Composable
fun NativeRequestComposer(
    repo:QuartinautRepository,
    initialKind:String="Suche",
    onDone:()->Unit
) {
    var step by rememberSaveable { mutableIntStateOf(0) }
    var title by rememberSaveable { mutableStateOf("") }
    var details by rememberSaveable { mutableStateOf("") }
    var kind by rememberSaveable(initialKind) { mutableStateOf(initialKind) }
    var category by rememberSaveable { mutableStateOf("Alltagshilfe") }
    var urgency by rememberSaveable { mutableStateOf("Diese Woche") }
    var categoriesOpen by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var confirmed by remember { mutableStateOf(false) }
    val photoToken=rememberSaveable {
        java.util.UUID.randomUUID().toString().replace("-","")
    }
    val photoPaths=remember { mutableStateListOf<String>() }
    BackHandler(enabled=step>0) { step-=1; error="" }
    Column(Modifier.fillMaxSize().background(Color(0xFF111F19))
        .verticalScroll(rememberScrollState()).padding(horizontal=18.dp,vertical=16.dp),
        verticalArrangement=Arrangement.spacedBy(16.dp)) {
        Text("NACHBARSCHAFT",color=CreateAccent,style=MaterialTheme.typography.labelMedium)
        Text("Anliegen erstellen",color=Color.White,
            style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Schritt "+(step+1)+" von 3 · "+
            when(step){0->"Art & Kategorie";1->"Deine Beschreibung";else->"Prüfen & senden"},
            color=CreateText,style=MaterialTheme.typography.bodyMedium)
        LinearProgressIndicator(progress={ (step+1)/3f },
            modifier=Modifier.fillMaxWidth().height(5.dp),color=CreateAccent,
            trackColor=CreateBorder)
        if(step==0) {
            ComposerCard {
                Text("Was möchtest du machen?",color=Color.White,
                    style=MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    listOf("Suche","Biete").forEach { value ->
                        FilterChip(selected=kind==value,onClick={kind=value},
                            label={Text(if(value=="Suche")"Hilfe suchen" else "Hilfe anbieten")})
                    }
                }
                Text("Kategorie",color=CreateText,fontWeight=FontWeight.SemiBold)
                Box {
                    OutlinedButton(onClick={categoriesOpen=true},
                        modifier=Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.Category,null)
                        Spacer(Modifier.width(8.dp))
                        Text(category,modifier=Modifier.weight(1f))
                        Icon(Icons.Default.ExpandMore,null)
                    }
                    DropdownMenu(expanded=categoriesOpen,onDismissRequest={categoriesOpen=false}) {
                        CreateCategories.forEach { cat ->
                            DropdownMenuItem(text={Text(cat)},onClick={
                                category=cat;categoriesOpen=false
                            })
                        }
                    }
                }
                Text("Wie dringend ist dein Anliegen?",color=CreateText,
                    fontWeight=FontWeight.SemiBold)
                UrgencyLabels.forEach { value ->
                    Row(Modifier.fillMaxWidth().clickable {urgency=value},
                        verticalAlignment=Alignment.CenterVertically) {
                        RadioButton(selected=urgency==value,onClick={urgency=value})
                        Text(value,color=Color.White)
                    }
                }
                Text("Gültig in deiner Gemeinde: "+repo.area()+" ("+repo.canton()+")",
                    color=CreateText,style=MaterialTheme.typography.bodySmall)
            }
            Button(onClick={step=1},modifier=Modifier.fillMaxWidth().height(52.dp)) {
                Text("Weiter · Beschreibung")
                Icon(Icons.Default.ArrowForward,null)
            }
        } else if(step==1) {
            ComposerCard {
                Text("Beschreibe dein Anliegen",color=Color.White,
                    style=MaterialTheme.typography.titleMedium)
                Text("Ein klarer Titel hilft deinen Nachbarn, deinen Beitrag sofort zu verstehen.",
                    color=CreateText,style=MaterialTheme.typography.bodySmall)
                OutlinedTextField(
                    value=title,onValueChange={title=it.take(100);error=""},
                    modifier=Modifier.fillMaxWidth(),
                    label={Text("Titel")},singleLine=true,
                    supportingText={Text(title.length.toString()+" / 100 Zeichen")},
                    keyboardOptions=KeyboardOptions(capitalization=KeyboardCapitalization.Sentences),
                    isError=title.isNotEmpty()&&title.trim().length<5
                )
                OutlinedTextField(value=details,onValueChange={details=it.take(1200);error=""},
                    modifier=Modifier.fillMaxWidth(),
                    minLines=5,maxLines=12,
                    label={Text("Was sollen andere darüber wissen?")},
                    supportingText={Text(details.length.toString()+" / 1200 Zeichen")},
                    keyboardOptions=KeyboardOptions(capitalization=KeyboardCapitalization.Sentences),
                    isError=details.isNotBlank()&&details.trim().length<12)
                NativePostPhotoPicker(repo,"requests",photoToken,
                    photoPaths.toList()) { updated ->
                    photoPaths.clear();photoPaths.addAll(updated)
                }
                Text("Tipp: Beschreibe Ort, Zeitraum und was du genau suchst oder anbietest. Veröffentliche keine privaten Kontaktdaten.",
                    color=CreateText,style=MaterialTheme.typography.bodySmall)
            }
            if(error.isNotBlank()) Text(error,color=Color(0xFFFFB4AB))
            Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick={step=0},modifier=Modifier.weight(1f)) {
                    Text("Zurück")
                }
                Button(onClick={
                    if(title.trim().length !in 5..100 || details.trim().length !in 12..1200)
                        error="Bitte mindestens 5 Zeichen im Titel und 12 in der Beschreibung eingeben."
                    else {error="";step=2}
                },modifier=Modifier.weight(1f)) { Text("Vorschau") }
            }
        } else {
            ComposerCard {
                Text("So wird dein Beitrag angezeigt",color=Color.White,
                    style=MaterialTheme.typography.titleMedium)
                Text(kind+" · "+category+" · "+urgency,
                    color=CreateAccent,style=MaterialTheme.typography.labelLarge)
                HorizontalDivider(color=CreateBorder)
                Text(title.trim(),color=Color.White,fontWeight=FontWeight.Bold,
                    style=MaterialTheme.typography.titleLarge)
                Text(details.trim(),color=CreateText,
                    style=MaterialTheme.typography.bodyMedium)
                HorizontalDivider(color=CreateBorder)
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.LocationOn,null,tint=CreateAccent)
                    Spacer(Modifier.width(7.dp))
                    Text(repo.area()+" ("+repo.canton()+")",color=CreateText)
                }
                Text("Dein Beitrag erscheint nach den geltenden Freigaberegeln. Bei noch ausstehender Prüfung bleibt er zunächst für dich sichtbar.",
                    color=CreateText,style=MaterialTheme.typography.bodySmall)
            }
            Row(verticalAlignment=Alignment.CenterVertically,
                modifier=Modifier.clickable {confirmed=!confirmed}) {
                Checkbox(checked=confirmed,onCheckedChange={confirmed=it})
                Text("Ich habe die Angaben geprüft und möchte den Beitrag einreichen.",
                    color=Color.White,style=MaterialTheme.typography.bodySmall)
            }
            Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick={step=1},modifier=Modifier.weight(1f),
                    enabled=!repo.busy) {Text("Bearbeiten")}
                Button(onClick={
                    repo.createRequest(title.trim(),details.trim(),category,kind,urgency,
                        onCreated=onDone,photoPaths=photoPaths.toList())
                },modifier=Modifier.weight(1f),
                    enabled=confirmed&&!repo.busy) {
                    if(repo.busy) CircularProgressIndicator(Modifier.size(18.dp),
                        strokeWidth=2.dp)
                    else Text("Einreichen")
                }
            }
        }
        TextButton(onClick={
            if(step>0)step-=1 else onDone()
        }) { Text(if(step==0)"Abbrechen" else "Vorheriger Schritt",color=CreateAccent) }
        Spacer(Modifier.height(10.dp))
    }
}

@Composable
private fun ComposerCard(content:@Composable ColumnScope.()->Unit) {
    Surface(color=CreatePane,shape=RoundedCornerShape(22.dp),
        border=androidx.compose.foundation.BorderStroke(1.dp,CreateBorder),
        modifier=Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(13.dp),
            content=content)
    }
}
