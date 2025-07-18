# Known Issues

## Control Bar Position Synchronization

**Issue:** Control bar position and size are not properly synchronized across different tabs.

**Expected Behavior:** When user drags the control bar to a new position on one tab, it should appear at the same position when switching to other tabs.

**Current Behavior:** Control bar appears at default position on each tab, ignoring previous position changes.

**Status:** Deferred - implementation added but not working correctly

**Implementation Notes:**
- Added global position storage in `globalTTSState.controlBarPosition`
- Added `updateGlobalPosition()` method to send position updates
- Added `applyPosition()` method to set position from saved coordinates
- Position data is included in broadcast messages
- Drag end event triggers position update

**Potential Issues:**
1. Position update messages may not be reaching background script
2. Timing issues with message sending/receiving
3. Position calculation might be incorrect across different page contexts
4. Browser coordinate system differences between tabs

**Next Steps:**
- Debug message flow between content script and background script
- Add more detailed logging for position updates
- Test with simpler position sync mechanism
- Consider using chrome.storage instead of runtime messages for position persistence