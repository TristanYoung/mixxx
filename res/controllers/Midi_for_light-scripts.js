function midi_for_light() {}

/*
    midi_for_light

    Sending information on midi for using in a light software.
    Extend the light show and make it sync to the current deck.
    - beat
    - bpm
    - deck number
    - deck change
    - MTC timecode
    - many, many vu-meter values
*/

///////////////////////////////////////////////////////////////
//                       USER OPTIONS                        //
///////////////////////////////////////////////////////////////
var midi_channel = 1; // set midi_channel. Valid range: 1 to 16.  
var enable_beat = true; // set to false if you not need beat
var enable_bpm = false; // set to false if you not need BPM
var enable_mtc_timecode = false; // set to false if you not need midi time code
var enable_vu_mono_current = false; // set to false if you not need VU mono current 
var enable_vu_mono_average_min = false; // set to false if you not need VU mono average min 
var enable_vu_mono_average_mid = false; // set to false if you not need VU mono average mid
var enable_vu_mono_average_max = false; // set to false if you not need VU mono average max
var enable_vu_mono_average_fit = false; // set to false if you not need VU mono average fit
var enable_vu_mono_current_meter = false; // set to false if you not need VU mono current meter
var enable_vu_mono_average_meter = false; // set to false if you not need VU mono average meter
var enable_vu_left_current = false; // set to false if you not need VU left current 
var enable_vu_left_average_min = false; // set to false if you not need VU left average min 
var enable_vu_left_average_mid = false; // set to false if you not need VU left average mid 
var enable_vu_left_average_max = false; // set to false if you not need VU left average max 
var enable_vu_left_average_fit = false; // set to false if you not need VU left average fit 
var enable_vu_left_current_meter = false; // set to false if you not need VU left current meter
var enable_vu_left_average_meter = false; // set to false if you not need VU left average meter
var enable_vu_right_current = false; // set to false if you not need VU right current 
var enable_vu_right_average_min = false; // set to false if you not need VU right average min 
var enable_vu_right_average_mid = false; // set to false if you not need VU right average mid 
var enable_vu_right_average_max = false; // set to false if you not need VU right average max 
var enable_vu_right_average_fit = false; // set to false if you not need VU right average fit 
var enable_vu_right_current_meter = false; // set to false if you not need VU right current meter
var enable_vu_right_average_meter = false; // set to false if you not need VU right average meter
var crossfader_deadzone = .1; // increase number to increase the crossfader centre deadzone, valid numbers are 0 through 1

///////////////////////////////////////////////////////////////
//              GLOBAL FOR SCRIPT, DON'T TOUCH               //
///////////////////////////////////////////////////////////////

var beat_watchdog = new Array(false, false, false, false);
var deck_beat_watchdog_timer = new Array(false, false, false, false);
var beat_watchdog_time = 1600; // time in ms for beat failed detection
var vu_array_fill_counter = 1;
var vu_array_fill_maximum = 50; // 25 = 1sec; 50 = 2sec;
var vu_array_mono = new Array(vu_array_fill_maximum);
var vu_array_left = new Array(vu_array_fill_maximum);
var vu_array_right = new Array(vu_array_fill_maximum);
if (enable_vu_mono_current === true || enable_vu_mono_average_min === true || enable_vu_mono_average_mid === true || enable_vu_mono_average_max === true ||
    enable_vu_mono_average_fit === true || enable_vu_mono_current_meter === true || enable_vu_mono_average_meter === true ||
    enable_vu_left_current === true || enable_vu_left_average_min === true || enable_vu_left_average_mid === true || enable_vu_left_average_max === true ||
    enable_vu_left_average_fit === true || enable_vu_left_current_meter === true || enable_vu_left_average_meter === true ||
    enable_vu_right_current === true || enable_vu_right_average_min === true || enable_vu_right_average_mid === true || enable_vu_right_average_max === true ||
    enable_vu_right_average_fit === true || enable_vu_right_current_meter === true || enable_vu_right_average_meter === true
) {
    var enable_vu_meter_global = true; // set to false if you not need complete VU-Meter
} else {
    var enable_vu_meter_global = false; // set to false if you not need complete VU-Meter
}

// Deck Score, used to determine active deck for midi output.
// Score columns: [0] deck fader position, [1] cross fader position, [2] deck playing, [3] deck master sync, [4] last control used
var deckScore = [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0]
    ];;

// Which control was last used, for score tie-breaker
var lastusedControl = 0;

// Track when points have been updated
var pointsUpdated = false;

///////////////////////////////////////////////////////////////
//                         FUNCTIONS                         //
///////////////////////////////////////////////////////////////

midi_for_light.init = function(id) { // called when the MIDI device is opened & set up   
    midi_for_light.id = id; // store the ID of this device for later use
    midi_for_light.directory_mode = false;
    midi_for_light.deck_current = 0;
    midi_for_light.crossfader_block = false;
    midi_for_light.crossfader_change_block_timer = -1; //[-1, -1];  Why was this an array?  Modified by Tristan
    midi_for_light.volumebeat = false;
    midi_for_light.volumeBeatBlockStatus = false;
    midi_for_light.volumeBeatBlock_timer = [-1, -1];
    midi_for_light.vu_meter_timer = [-1, -1];
    midi_for_light.volumebeat_on_delay_timer = [-1, -1];
    midi_for_light.scoreTimer = 0;          // timer for periodic scoring
    midi_for_light.scoreTimerPeriod = 1000; // wait time between calculating score

    //engine.connectControl("[Master]", "crossfader", "midi_for_light.crossfaderChange");

    if (enable_vu_meter_global === true) midi_for_light.vu_meter_timer = engine.beginTimer(40, "midi_for_light.vuMeter()");

    // Check midi_channel if value valid. Possible range is 1 to 16.
    if (midi_channel > 16) midi_channel = 16;
    if (midi_channel < 1) midi_channel = 1;

    for (var i = 0; i <= 3; i++) {
        deck_beat_watchdog_timer[i] = engine.beginTimer(beat_watchdog_time, "midi_for_light.deckBeatWatchdog(" + i + ")");
        engine.connectControl("[Channel" + (i + 1) + "]", "beat_active", "midi_for_light.deckBeatOutputToMidi");
        engine.connectControl("[Channel" + (i + 1) + "]", "volume", "midi_for_light.deckFaderChange");
        engine.connectControl("[Channel" + (i + 1) + "]", "play", "midi_for_light.deckButtonPlay");
        engine.connectControl("[Channel" + (i + 1) + "]", "sync_enabled", "midi_for_light.deckButtonSync");
        engine.connectControl("[Master]", "crossfader", "midi_for_light.crossfaderChange");

        /////////////////////////////
        //  PROPOSED FOR DELETION
        ////////////////////////////
        //engine.connectControl("[Channel" + (i + 1) + "]", "volume", "midi_for_light.deckVolumeChange");
        //engine.connectControl("[Channel" + (i + 1) + "]", "play", "midi_for_light.deckButtonPlay");

        if (enable_mtc_timecode === true) engine.connectControl("[Channel" + (i + 1) + "]", "playposition", "midi_for_light.sendMidiMtcFullFrame");
    }

    // initialize scoring system
    midi_for_light.deckFaderChange(0,"[Channel1]",0);
    midi_for_light.deckFaderChange(0,"[Channel2]",0);
    midi_for_light.deckFaderChange(0,"[Channel3]",0);
    midi_for_light.deckFaderChange(0,"[Channel4]",0);
    midi_for_light.crossfaderChange(0,"[Master]",0);
    midi_for_light.crossfaderChange(0,"[Master]",0);
    midi_for_light.crossfaderChange(0,"[Master]",0);
    midi_for_light.crossfaderChange(0,"[Master]",0);
    midi_for_light.deckButtonPlay(0,"[Channel1]",0);
    midi_for_light.deckButtonPlay(0,"[Channel2]",0);
    midi_for_light.deckButtonPlay(0,"[Channel3]",0);
    midi_for_light.deckButtonPlay(0,"[Channel4]",0);
    midi_for_light.deckButtonSync(0,"[Channel1]",0);
    midi_for_light.deckButtonSync(0,"[Channel2]",0);
    midi_for_light.deckButtonSync(0,"[Channel3]",0);
    midi_for_light.deckButtonSync(0,"[Channel4]",0);

    midi_for_light.scoreTimer = engine.beginTimer(midi_for_light.scoreTimerPeriod, "midi_for_light.calculatedeckScore");
};

midi_for_light.shutdown = function(id) { // called when the MIDI device is closed
    
    engine.stopTimer(deck_beat_watchdog_timer[0]);
    engine.stopTimer(deck_beat_watchdog_timer[1]);
    engine.stopTimer(deck_beat_watchdog_timer[2]);
    engine.stopTimer(deck_beat_watchdog_timer[3]);
    
    engine.stopTimer(midi_for_light.scoreTimer);
    engine.stopTimer(midi_for_light.vu_meter_timer);
    engine.stopTimer(midi_for_light.volumeBeatBlock_timer);
    engine.stopTimer(midi_for_light.crossfader_change_block_timer);
    engine.stopTimer(midi_for_light.volumebeat_on_delay_timer);
};

// Deck fader position scoring
midi_for_light.deckFaderChange = function(value, group, control) { // called when deck fader is moved
    var deck = parseInt(group.substring(8, 9)) - 1;
    var pointValue = 0; // change this to increase awarded points from base fader position

    deckScore[deck][0] = engine.getValue("[Channel" + (deck + 1) + "]", "volume") + pointValue; // fader position = point between 0 and 1 and add additional points

    for (i=0; i<4; i++){
        deckScore[i][4] = 0; // reset points on all controls
    }
    deckScore[deck][4] = 1; // one point awarded for last control used
    
    pointsUpdated = true;
};

// Crossfader position scoring
midi_for_light.crossfaderChange = function(value, group, control) { // called when deck fader is moved
    var pointValue = 0; // change this to increase awarded points from base crossfader position
    var crossfaderValue = engine.getValue("[Master]", "crossfader"); // crossfader position

    // crossfader deadzone calculation
    if (crossfaderValue >= -crossfader_deadzone && crossfaderValue <= crossfader_deadzone){
        crossfaderValue = 0;
    }
   
    
    if (crossfaderValue < 0) { // crossfader tot he left of centre, points are between 0 and 1
        //award points for active fader, unary to make score positive
        deckScore[0][1] = -crossfaderValue * pointValue;
        deckScore[2][1] = -crossfaderValue * pointValue;
        
        // no points to other decks
        deckScore[1][1] = 0;
        deckScore[3][1] = 0;
            
        // last control used, award points for active side
        deckScore[0][4] = 1;
        deckScore[2][4] = 1;

        // last control used, no points for inactive side
        deckScore[1][4] = 0;
        deckScore[3][4] = 0;
    }
    
    if (crossfaderValue > 0) { // crossfader to the right of centre, points are between 0 and 1
        // award points for active fader position
        deckScore[1][1] = crossfaderValue * pointValue;
        deckScore[3][1] = crossfaderValue * pointValue;
        
        // no points to other decks
        deckScore[0][1] = 0;
        deckScore[2][1] = 0;
        
        // last control used, award points for active side
        deckScore[1][4] = 1;
        deckScore[3][4] = 1;

        // last control used, no points for inactive side
        deckScore[0][4] = 0;
        deckScore[2][4] = 0;
        
    }
    
    if (crossfaderValue = 0) {
        // fader position centred, no points
        deckScore[0][1] = 0;
        deckScore[1][1] = 0;
        deckScore[2][1] = 0;
        deckScore[3][1] = 0;
    }
    
    pointsUpdated = true;
};

// Deck playing scoring
midi_for_light.deckButtonPlay = function(value, group, control) {
    var deck = parseInt(group.substring(8, 9)) - 1;
    var pointValue = 2; // change this to increase awarded points

    if (engine.getValue("[Channel" + (deck + 1) + "]", "play_latched")) {
        deckScore[deck][2] = pointValue; // deck is playing 
    } else {
        deckScore[deck][2] = 0;          // deck is not playing
    }
    
    pointsUpdated = true;
};

// Dec master sync scoring
midi_for_light.deckButtonSync = function(value, group, control) {
    var deck = parseInt(group.substring(8, 9)) - 1;
    var pointValue = 2; // change this to increase awarded points

    if (engine.getValue("[Channel" + (deck + 1) + "]", "sync_master")) {
        deckScore[deck][3] = pointValue; // master sync is enabled on deck
    } else {
        deckScore[deck][3] = 0;          // master sync is disabled on deck
    }
    
    pointsUpdated = true;
};

// calculate score to determine most likely active deck, and set active
midi_for_light.calculatedeckScore  = function(value, group, control) {
    var score = [0,0,0,0]; // score per deck
    var highscore = -1;    // highest score
    var prioritydeck = -1; // deck with the highest score takes priority
    
    // Calculate score if points have changed
    if (pointsUpdated) {
        for (i=0; i<4; i++){
            for (j=0; j<5; j++){
                score[i] += deckScore[i][j];
                }
            if (score[i] > highscore) { // tends to give lower numbered decks increased score weight
                highscore = score[i];
                prioritydeck = i;
            }
        }

        // set deck active for midi for light
        if (midi_for_light.deck_current != prioritydeck){
            midi_for_light.deck_current = prioritydeck; // set current deck to deck with the highest score
            midi.sendShortMsg(0x8F + midi_channel, 0x30, 0x00 + midi_for_light.deck_current); // note C on with value 0 + deck
            midi.sendShortMsg(0x7F + midi_channel, 0x30, 0x00 + midi_for_light.deck_current); // note C off with value 0 + deck
        }
    }
    
    pointsUpdated = false;
    
};




////////////////////////////
// PROPOSED FOR DELETION 
///////////////////////////
/* midi_for_light.deckButtonPlay2 = function(value, group, control) { // called when click a play button
    var deck = parseInt(group.substring(8, 9)) - 1;

    if (value == 1) { // deck play on
        engine.stopTimer(deck_beat_watchdog_timer[deck]);
        beat_watchdog[deck] = false;
        deck_beat_watchdog_timer[deck] = engine.beginTimer(beat_watchdog_time, "midi_for_light.deckBeatWatchdog(" + deck + ")");
    } else { // deck play stop
        if (deck_beat_watchdog_timer[deck]) {
            engine.stopTimer(deck_beat_watchdog_timer[deck]);
            deck_beat_watchdog_timer[deck]=false;
        }
        beat_watchdog[deck] = true;
    }

    if (midi_for_light.volumebeat === true) {
        midi_for_light.deckVolumeChange();
    } else {
        midi_for_light.crossfaderChange2();
    }
}; */

midi_for_light.deckBeatWatchdog = function(deck) { //  if current deck beat lost without reason, search a new current deck   
    engine.stopTimer(deck_beat_watchdog_timer[deck]);
    beat_watchdog[deck] = true;
    if (midi_for_light.volumebeat === false) midi_for_light.crossfaderChange();
};

midi_for_light.vuMeter = function() { // read, calculate and send vu-meter values
    // set output range for MIDI
    var vu_out_min = 0;
    var vu_out_max = 127;
    var vu_out_range = vu_out_max - vu_out_min;

    // get current value Vu-Meter
    var vu_mono_current = engine.getValue("[Master]", "VuMeter");
    var vu_left_current = engine.getValue("[Master]", "VuMeterL");
    var vu_right_current = engine.getValue("[Master]", "VuMeterR");

    // arraycounter 
    vu_array_fill_counter++;
    if (vu_array_fill_counter > vu_array_fill_maximum) {
        vu_array_fill_counter = 1;
    }

    // transfer current VU in array
    vu_array_mono[vu_array_fill_counter] = vu_mono_current;
    vu_array_left[vu_array_fill_counter] = vu_left_current;
    vu_array_right[vu_array_fill_counter] = vu_right_current;

    // search min- and max VU in array
    var vu_mono_average_min = vu_array_mono[1];
    var vu_mono_average_mid = 0;
    var vu_mono_average_max = vu_array_mono[1];
    var vu_left_average_min = vu_array_left[1];
    var vu_left_average_mid = 0;
    var vu_left_average_max = vu_array_left[1];
    var vu_right_average_min = vu_array_right[1];
    var vu_right_average_mid = 0;
    var vu_right_average_max = vu_array_right[1];
    var z = 1;
    while (z < vu_array_fill_maximum) {
        // mono
        if (vu_array_mono[z] < vu_mono_average_min) vu_mono_average_min = vu_array_mono[z];
        vu_mono_average_mid = vu_mono_average_mid + vu_array_mono[z];
        if (vu_array_mono[z] > vu_mono_average_max) vu_mono_average_max = vu_array_mono[z];
        // left
        if (vu_array_left[z] < vu_left_average_min) vu_left_average_min = vu_array_left[z];
        vu_left_average_mid = vu_left_average_mid + vu_array_left[z];
        if (vu_array_left[z] > vu_left_average_max) vu_left_average_max = vu_array_left[z];
        // right
        if (vu_array_right[z] < vu_right_average_min) vu_right_average_min = vu_array_right[z];
        vu_right_average_mid = vu_right_average_mid + vu_array_right[z];
        if (vu_array_right[z] > vu_right_average_max) vu_right_average_max = vu_array_right[z];
        z++;
    }

    // calculate average mid and output
    if (enable_vu_mono_average_mid === true) {
        vu_mono_average_mid = ((vu_mono_average_mid / vu_array_fill_maximum) * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x42, vu_mono_average_mid); // dez.66, okt.5 note F#
    }
    if (enable_vu_left_average_mid === true) {
        vu_left_average_mid = ((vu_left_average_mid / vu_array_fill_maximum) * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x52, vu_left_average_mid); // dez.82, okt.6 note A#
    }
    if (enable_vu_right_average_mid === true) {
        vu_right_average_mid = ((vu_right_average_mid / vu_array_fill_maximum) * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x62, vu_right_average_mid); // dez.98, okt.8 note D
    }

    // calculate average_fit
    var vu_mono_average_fit = (vu_mono_current - vu_mono_average_min) / (vu_mono_average_max - vu_mono_average_min);
    var vu_left_average_fit = (vu_left_current - vu_left_average_min) / (vu_left_average_max - vu_left_average_min);
    var vu_right_average_fit = (vu_right_current - vu_right_average_min) / (vu_right_average_max - vu_right_average_min);

    // calculate VU-meter and output
    if (enable_vu_mono_current_meter === true) {
        var vu_mono_current_meter1 = (vu_mono_current * 4) - 0;
        if (vu_mono_current_meter1 < 0) vu_mono_current_meter1 = 0;
        if (vu_mono_current_meter1 > 1) vu_mono_current_meter1 = 1;
        var vu_mono_current_meter2 = (vu_mono_current * 4) - 1;
        if (vu_mono_current_meter2 < 0) vu_mono_current_meter2 = 0;
        if (vu_mono_current_meter2 > 1) vu_mono_current_meter2 = 1;
        var vu_mono_current_meter3 = (vu_mono_current * 4) - 2;
        if (vu_mono_current_meter3 < 0) vu_mono_current_meter3 = 0;
        if (vu_mono_current_meter3 > 1) vu_mono_current_meter3 = 1;
        var vu_mono_current_meter4 = (vu_mono_current * 4) - 3;
        if (vu_mono_current_meter4 < 0) vu_mono_current_meter4 = 0;
        if (vu_mono_current_meter4 > 1) vu_mono_current_meter4 = 1;
        vu_mono_current_meter1 = (vu_mono_current_meter1 * vu_out_range) + vu_out_min;
        vu_mono_current_meter2 = (vu_mono_current_meter2 * vu_out_range) + vu_out_min;
        vu_mono_current_meter3 = (vu_mono_current_meter3 * vu_out_range) + vu_out_min;
        vu_mono_current_meter4 = (vu_mono_current_meter4 * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x45, vu_mono_current_meter1); // dez.69, okt.5 note A
        midi.sendShortMsg(0x8F + midi_channel, 0x46, vu_mono_current_meter2); // dez.70, okt.5 note A#
        midi.sendShortMsg(0x8F + midi_channel, 0x47, vu_mono_current_meter3); // dez.71, okt.5 note B
        midi.sendShortMsg(0x8F + midi_channel, 0x48, vu_mono_current_meter4); // dez.72, okt.6 note C
    }
    if (enable_vu_mono_average_meter === true) {
        var vu_mono_average_meter1 = (vu_mono_average_fit * 4) - 0;
        if (vu_mono_average_meter1 < 0) vu_mono_average_meter1 = 0;
        if (vu_mono_average_meter1 > 1) vu_mono_average_meter1 = 1;
        var vu_mono_average_meter2 = (vu_mono_average_fit * 4) - 1;
        if (vu_mono_average_meter2 < 0) vu_mono_average_meter2 = 0;
        if (vu_mono_average_meter2 > 1) vu_mono_average_meter2 = 1;
        var vu_mono_average_meter3 = (vu_mono_average_fit * 4) - 2;
        if (vu_mono_average_meter3 < 0) vu_mono_average_meter3 = 0;
        if (vu_mono_average_meter3 > 1) vu_mono_average_meter3 = 1;
        var vu_mono_average_meter4 = (vu_mono_average_fit * 4) - 3;
        if (vu_mono_average_meter4 < 0) vu_mono_average_meter4 = 0;
        if (vu_mono_average_meter4 > 1) vu_mono_average_meter4 = 1;
        vu_mono_average_meter1 = (vu_mono_average_meter1 * vu_out_range) + vu_out_min;
        vu_mono_average_meter2 = (vu_mono_average_meter2 * vu_out_range) + vu_out_min;
        vu_mono_average_meter3 = (vu_mono_average_meter3 * vu_out_range) + vu_out_min;
        vu_mono_average_meter4 = (vu_mono_average_meter4 * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x49, vu_mono_average_meter1); // dez.73, okt.6 note C#
        midi.sendShortMsg(0x8F + midi_channel, 0x4A, vu_mono_average_meter2); // dez.74, okt.6 note D
        midi.sendShortMsg(0x8F + midi_channel, 0x4B, vu_mono_average_meter3); // dez.75, okt.6 note D#
        midi.sendShortMsg(0x8F + midi_channel, 0x4C, vu_mono_average_meter4); // dez.76, okt.6 note E
    }
    if (enable_vu_left_current_meter === true) {
        var vu_left_current_meter1 = (vu_left_current * 4) - 0;
        if (vu_left_current_meter1 < 0) vu_left_current_meter1 = 0;
        if (vu_left_current_meter1 > 1) vu_left_current_meter1 = 1;
        var vu_left_current_meter2 = (vu_left_current * 4) - 1;
        if (vu_left_current_meter2 < 0) vu_left_current_meter2 = 0;
        if (vu_left_current_meter2 > 1) vu_left_current_meter2 = 1;
        var vu_left_current_meter3 = (vu_left_current * 4) - 2;
        if (vu_left_current_meter3 < 0) vu_left_current_meter3 = 0;
        if (vu_left_current_meter3 > 1) vu_left_current_meter3 = 1;
        var vu_left_current_meter4 = (vu_left_current * 4) - 3;
        if (vu_left_current_meter4 < 0) vu_left_current_meter4 = 0;
        if (vu_left_current_meter4 > 1) vu_left_current_meter4 = 1;
        vu_left_current_meter1 = (vu_left_current_meter1 * vu_out_range) + vu_out_min;
        vu_left_current_meter2 = (vu_left_current_meter2 * vu_out_range) + vu_out_min;
        vu_left_current_meter3 = (vu_left_current_meter3 * vu_out_range) + vu_out_min;
        vu_left_current_meter4 = (vu_left_current_meter4 * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x55, vu_left_current_meter1); // dez.85, okt.7 note C#
        midi.sendShortMsg(0x8F + midi_channel, 0x56, vu_left_current_meter2); // dez.86, okt.7 note D
        midi.sendShortMsg(0x8F + midi_channel, 0x57, vu_left_current_meter3); // dez.87, okt.7 note D#
        midi.sendShortMsg(0x8F + midi_channel, 0x58, vu_left_current_meter4); // dez.88, okt.7 note E
    }
    if (enable_vu_left_average_meter === true) {
        var vu_left_average_meter1 = (vu_left_average_fit * 4) - 0;
        if (vu_left_average_meter1 < 0) vu_left_average_meter1 = 0;
        if (vu_left_average_meter1 > 1) vu_left_average_meter1 = 1;
        var vu_left_average_meter2 = (vu_left_average_fit * 4) - 1;
        if (vu_left_average_meter2 < 0) vu_left_average_meter2 = 0;
        if (vu_left_average_meter2 > 1) vu_left_average_meter2 = 1;
        var vu_left_average_meter3 = (vu_left_average_fit * 4) - 2;
        if (vu_left_average_meter3 < 0) vu_left_average_meter3 = 0;
        if (vu_left_average_meter3 > 1) vu_left_average_meter3 = 1;
        var vu_left_average_meter4 = (vu_left_average_fit * 4) - 3;
        if (vu_left_average_meter4 < 0) vu_left_average_meter4 = 0;
        if (vu_left_average_meter4 > 1) vu_left_average_meter4 = 1;
        vu_left_average_meter1 = (vu_left_average_meter1 * vu_out_range) + vu_out_min;
        vu_left_average_meter2 = (vu_left_average_meter2 * vu_out_range) + vu_out_min;
        vu_left_average_meter3 = (vu_left_average_meter3 * vu_out_range) + vu_out_min;
        vu_left_average_meter4 = (vu_left_average_meter4 * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x59, vu_left_average_meter1); // dez.89, okt.7 note F
        midi.sendShortMsg(0x8F + midi_channel, 0x5A, vu_left_average_meter2); // dez.90, okt.7 note F#
        midi.sendShortMsg(0x8F + midi_channel, 0x5B, vu_left_average_meter3); // dez.91, okt.7 note G
        midi.sendShortMsg(0x8F + midi_channel, 0x5C, vu_left_average_meter4); // dez.92, okt.7 note G#
    }
    if (enable_vu_right_current_meter === true) {
        var vu_right_current_meter1 = (vu_right_current * 4) - 0;
        if (vu_right_current_meter1 < 0) vu_right_current_meter1 = 0;
        if (vu_right_current_meter1 > 1) vu_right_current_meter1 = 1;
        var vu_right_current_meter2 = (vu_right_current * 4) - 1;
        if (vu_right_current_meter2 < 0) vu_right_current_meter2 = 0;
        if (vu_right_current_meter2 > 1) vu_right_current_meter2 = 1;
        var vu_right_current_meter3 = (vu_right_current * 4) - 2;
        if (vu_right_current_meter3 < 0) vu_right_current_meter3 = 0;
        if (vu_right_current_meter3 > 1) vu_right_current_meter3 = 1;
        var vu_right_current_meter4 = (vu_right_current * 4) - 3;
        if (vu_right_current_meter4 < 0) vu_right_current_meter4 = 0;
        if (vu_right_current_meter4 > 1) vu_right_current_meter4 = 1;
        vu_right_current_meter1 = (vu_right_current_meter1 * vu_out_range) + vu_out_min;
        vu_right_current_meter2 = (vu_right_current_meter2 * vu_out_range) + vu_out_min;
        vu_right_current_meter3 = (vu_right_current_meter3 * vu_out_range) + vu_out_min;
        vu_right_current_meter4 = (vu_right_current_meter4 * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x65, vu_right_current_meter1); // dez.101, okt.8 note F
        midi.sendShortMsg(0x8F + midi_channel, 0x66, vu_right_current_meter2); // dez.102, okt.8 note F#
        midi.sendShortMsg(0x8F + midi_channel, 0x67, vu_right_current_meter3); // dez.103, okt.8 note G
        midi.sendShortMsg(0x8F + midi_channel, 0x68, vu_right_current_meter4); // dez.104, okt.8 note G#
    }
    if (enable_vu_right_average_meter === true) {
        var vu_right_average_meter1 = (vu_right_average_fit * 4) - 0;
        if (vu_right_average_meter1 < 0) vu_right_average_meter1 = 0;
        if (vu_right_average_meter1 > 1) vu_right_average_meter1 = 1;
        var vu_right_average_meter2 = (vu_right_average_fit * 4) - 1;
        if (vu_right_average_meter2 < 0) vu_right_average_meter2 = 0;
        if (vu_right_average_meter2 > 1) vu_right_average_meter2 = 1;
        var vu_right_average_meter3 = (vu_right_average_fit * 4) - 2;
        if (vu_right_average_meter3 < 0) vu_right_average_meter3 = 0;
        if (vu_right_average_meter3 > 1) vu_right_average_meter3 = 1;
        var vu_right_average_meter4 = (vu_right_average_fit * 4) - 3;
        if (vu_right_average_meter4 < 0) vu_right_average_meter4 = 0;
        if (vu_right_average_meter4 > 1) vu_right_average_meter4 = 1;
        vu_right_average_meter1 = (vu_right_average_meter1 * vu_out_range) + vu_out_min;
        vu_right_average_meter2 = (vu_right_average_meter2 * vu_out_range) + vu_out_min;
        vu_right_average_meter3 = (vu_right_average_meter3 * vu_out_range) + vu_out_min;
        vu_right_average_meter4 = (vu_right_average_meter4 * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x69, vu_right_average_meter1); // dez.105, okt.8 note A
        midi.sendShortMsg(0x8F + midi_channel, 0x6A, vu_right_average_meter2); // dez.106, okt.8 note A#
        midi.sendShortMsg(0x8F + midi_channel, 0x6B, vu_right_average_meter3); // dez.107, okt.8 note B
        midi.sendShortMsg(0x8F + midi_channel, 0x6C, vu_right_average_meter4); // dez.108, okt.9 note C
    }

    // output current, average-min, average-max and average-fit
    if (enable_vu_mono_current === true) {
        vu_mono_current = (vu_mono_current * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x40, vu_mono_current); // dez.64, okt.5 note E
    }
    if (enable_vu_mono_average_min === true) {
        vu_mono_average_min = (vu_mono_average_min * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x41, vu_mono_average_min); // dez.65, okt.5 note F
    }
    if (enable_vu_mono_average_max === true) {
        vu_mono_average_max = (vu_mono_average_max * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x43, vu_mono_average_max); // dez.67, okt.5 note G
    }
    if (enable_vu_mono_average_fit === true) {
        vu_mono_average_fit = (vu_mono_average_fit * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x44, vu_mono_average_fit); // dez.68, okt.5 note G#
    }
    if (enable_vu_left_current === true) {
        vu_left_current = (vu_left_current * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x50, vu_left_current); // dez.80, okt.6 note G#
    }
    if (enable_vu_left_average_min === true) {
        vu_left_average_min = (vu_left_average_min * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x51, vu_left_average_min); // dez.81, okt.6 note A
    }
    if (enable_vu_left_average_max === true) {
        vu_left_average_max = (vu_left_average_max * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x53, vu_left_average_max); // dez.83, okt.6 note B
    }
    if (enable_vu_left_average_fit === true) {
        vu_left_average_fit = (vu_left_average_fit * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x54, vu_left_average_fit); // dez.84, okt.7 note C
    }
    if (enable_vu_right_current === true) {
        vu_right_current = (vu_right_current * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x60, vu_right_current); // dez.96, okt.8 note C
    }
    if (enable_vu_right_average_min === true) {
        vu_right_average_min = (vu_right_average_min * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x61, vu_right_average_min); // dez.97, okt.8 note C#
    }
    if (enable_vu_right_average_max === true) {
        vu_right_average_max = (vu_right_average_max * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x63, vu_right_average_max); // dez.99, okt.8 note D#
    }
    if (enable_vu_right_average_fit === true) {
        vu_right_average_fit = (vu_right_average_fit * vu_out_range) + vu_out_min;
        midi.sendShortMsg(0x8F + midi_channel, 0x64, vu_right_average_fit); // dez.100, okt.8 note E
    }
};


/////////////////////////////
//  PROPOSED FOR DELETION
////////////////////////////
/* midi_for_light.deckVolumeChange = function(value, group, control) { // deck volume changed
    if (midi_for_light.volumebeat === false) return; // out if volumebeat is not active
    if (midi_for_light.volumeBeatBlockStatus === true) return; // out if volumebeat is blocked

    var deckvolume = new Array(0, 0, 0, 0);
    var volumemax = 0;
    var deckneu = -1;
var deckmaxvolumecount = 0; // how many decks are at maximum volume count

    // get volume from the decks and check it for use
    for (var z = 0; z <= 3; z++) {
        deckvolume[z] = engine.getValue("[Channel" + (z + 1) + "]", "volume");
        print("beat_watchdog " + z + ": " + beat_watchdog[z]);
        if (deckvolume[z] > 0 && deckvolume[z] >= volumemax && beat_watchdog[z] === false) {
            volumemax = deckvolume[z];
            deckneu = z;
        }
    }
    
    if (deckneu == -1) return; // out if no new valid deck

    // check deck change and send change message
    if (deckneu != midi_for_light.deck_current) {
        if (deckmaxvolumecount > 1){
            midi_for_light.crossfaderChange2();
        }
        else {
            midi_for_light.deck_current = deckneu;
            midi.sendShortMsg(0x8F + midi_channel, 0x30, 0x64 + deckneu); // Note C on with 64 and add deck
            midi_for_light.volumeBeatBlockStatus = true;
            midi_for_light.volumeBeatBlock_timer = engine.beginTimer(1000, "midi_for_light.volumeBeatBlock()");
        }
    }
}; */

midi_for_light.volumeBeatBlock = function() { // prevent deck change for one second
    engine.stopTimer(midi_for_light.volumeBeatBlock_timer);
    midi_for_light.volumeBeatBlockStatus = false;
    midi.sendShortMsg(0x8F + midi_channel, 0x30, 0x0); // note C on with value 0
    midi.sendShortMsg(0x7F + midi_channel, 0x30, 0x0); // note C off with value 0
};

midi_for_light.volumeBeatOnDelay = function() { // allow deck change with volume after 3 second fader do nothing
    engine.stopTimer(midi_for_light.volumebeat_on_delay_timer);
    midi_for_light.volumebeat = true;
};

/////////////////////////////
//  PROPOSED FOR DELETION
////////////////////////////
/* midi_for_light.crossfaderChange2 = function() { // crossfader chenge, check deck change
    // if fader prevent, go out
    if (midi_for_light.crossfader_block === true) return;

    // check changing to "deck change by volume" method
    midi_for_light.volumebeat = false;
    if (midi_for_light.volumebeat_on_delay_timer) {
        engine.stopTimer(midi_for_light.volumebeat_on_delay_timer);
        midi_for_light.volumebeat_on_delay_timer = false;
    }
    
    if (engine.getValue("[Master]", "crossfader") > -0.25) { // crossfader more than 25% left;
        if (engine.getValue("[Master]", "crossfader") < 0.25) { // crossfader more then 25% right;
            midi_for_light.volumebeat_on_delay_timer = engine.beginTimer(3000, "midi_for_light.volumeBeatOnDelay()");
        }
    }

    // if crossfader in middle position, go out
    if (engine.getValue("[Master]", "crossfader") === 0) return;

    // check what deck is current, crossfader exact 0 is defined as left
    var deck = 0;
    if (engine.getValue("[Master]", "crossfader") > 0) { // crossfader is right, not middle
        deck = 1;
        if (beat_watchdog[1] === true) deck = 3;
    } else {
        deck = 0;
        if (beat_watchdog[0] === true) deck = 2;
    }

    // check if deck has been changed
    if (deck != midi_for_light.deck_current) {
        midi_for_light.deck_current = deck;
        midi.sendShortMsg(0x8F + midi_channel, 0x30, 0x64 + deck); // note C on with value 64 + deck
        midi_for_light.crossfader_block = true;
        midi_for_light.crossfader_change_block_timer = engine.beginTimer(1000, "midi_for_light.crossfaderChangeBlock()");
    }
}; */

/////////////////////////////
//  PROPOSED FOR DELETION
////////////////////////////
/* midi_for_light.crossfaderChangeBlock = function() { // prevent deck change for one second
    engine.stopTimer(midi_for_light.crossfader_change_block_timer);
    midi_for_light.crossfader_block = false;
    midi.sendShortMsg(0x8F + midi_channel, 0x30, 0x0); // note C on with value 0
    midi.sendShortMsg(0x7F + midi_channel, 0x30, 0x0); // note C off with value 0
    midi_for_light.crossfaderChange2(); // check deck is current
}; */

midi_for_light.sendMidiMtcFullFrame = function(value, group, control) { // sends an MTC full frame
    var deck = parseInt(group.substring(8, 9)) - 1;
    if (deck != midi_for_light.deck_current) return;

    var fps = 2; // 2 = 25 FPS
    var duration = engine.getValue(group, "track_samples") / engine.getValue(group, "track_samplerate") / 2;
    var PlayPositionRest = duration * engine.getValue(group, "playposition");

    if (PlayPositionRest < 0) PlayPositionRest = 0;

    // calculate position hour and stripping from PlayPositionRest
    var hr = Math.floor(PlayPositionRest / 3600);
    PlayPositionRest = PlayPositionRest - (hr * 3600);
    // calculate position minute and stripping from PlayPositionRest
    var mn = Math.floor(PlayPositionRest / 60);
    PlayPositionRest = PlayPositionRest - (mn * 60);
    // calculate position second and stripping from PlayPositionRest
    var ss = Math.floor(PlayPositionRest);
    PlayPositionRest = PlayPositionRest - ss;
    // calculate position frame and stripping from PlayPositionRest
    var fr = Math.floor(PlayPositionRest * 25);
    // construct Sysex-Fram and send it
    var fullframe = [0xf0, 0x7f, 0x7f, 0x01, 0x01, (16 * fps) + hr, mn, ss, fr, 0xf7];
    midi.sendSysexMsg(fullframe, 10);
};

midi_for_light.deckBeatOutputToMidi = function(value, group, control) { // send midi note for beat and the BPM vaelue
    var deck = parseInt(group.substring(8, 9)) - 1;
    var deck_bpm = parseInt(engine.getValue(group, "bpm")) - 50;

    // reset deck beat watchdog
    engine.stopTimer(deck_beat_watchdog_timer[deck]);
    beat_watchdog[deck] = false;
    deck_beat_watchdog_timer[deck] = engine.beginTimer(beat_watchdog_time, "midi_for_light.deckBeatWatchdog(" + deck + ")");

    // fit deck bpm to midi range 0-127
    if (deck_bpm <= 0) deck_bpm = 0;
    if (deck_bpm >= 127) deck_bpm = 127;

    if (midi_for_light.deck_current == deck) { // only when its the correct deck
        if (value) { // beat is on, sending note on
            // temporary change: if looping is on, do not send
            if (enable_beat === true && !engine.getValue("[Channel" + (midi_for_light.deck_current + 1) + "]","loop_enabled")) {
                midi.sendShortMsg(0x8F + midi_channel, 0x32, 0x64); // note D (50) on with value 64
            }
            if (enable_bpm === true) midi.sendShortMsg(0x8f + midi_channel, 0x34, deck_bpm); // note E (52) on with value BPM
        } else { // beat is off, send note off
            if (enable_beat === true) {
                midi.sendShortMsg(0x8F + midi_channel, 0x32, 0x0); // note D (50) on with value 0
                midi.sendShortMsg(0x7F + midi_channel, 0x32, 0x0); // note D (59) off with value 0
            }
        }
    }
};