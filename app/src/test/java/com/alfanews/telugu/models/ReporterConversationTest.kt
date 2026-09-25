package com.alfanews.telugu.models

import org.junit.Assert.*
import org.junit.Test

class ReporterConversationTest {

    @Test
    fun testReporterConversationDefaults() {
        val conv = ReporterConversation(
            reporterId = "rep_123",
            reporterName = "Ravi Kumar",
            reporterPhone = "9876543210",
            reporterDistrict = "Guntur",
            unreadCountForAdmin = 3,
            unreadCountForReporter = 0
        )

        assertEquals("rep_123", conv.reporterId)
        assertEquals("Ravi Kumar", conv.reporterName)
        assertEquals(3, conv.unreadCountForAdmin)
        assertEquals(0, conv.unreadCountForReporter)
        assertTrue(conv.unreadCountForAdmin > 0)
    }

    @Test
    fun testReporterMessageCreation() {
        val msg = ReporterMessage(
            id = "msg_001",
            senderId = "admin_01",
            senderName = "Admin Desk",
            senderRole = "ADMIN",
            text = "దయచేసి మీ మండలం వార్తలను అప్‌డేట్ చేయండి.",
            type = "CHAT",
            read = false
        )

        assertEquals("ADMIN", msg.senderRole)
        assertEquals("CHAT", msg.type)
        assertFalse(msg.read)
    }

    @Test
    fun testWarningMessageType() {
        val warningMsg = ReporterMessage(
            id = "warn_001",
            senderId = "system_monitor",
            senderName = "AlfaNews Desk",
            senderRole = "ADMIN",
            text = "హెచ్చరిక: గత 3 రోజులుగా మీరు వార్తలు పోస్ట్ చేయలేదు.",
            type = "WARNING"
        )

        assertEquals("WARNING", warningMsg.type)
    }

    @Test
    fun testBroadcastMessageType() {
        val broadcastMsg = ReporterMessage(
            id = "bc_001",
            senderId = "admin_01",
            senderName = "Chief Editor",
            senderRole = "ADMIN",
            text = "అందరు రిపోర్టర్లు రేపటి అసెంబ్లీ సమావేశాల కవరేజ్ సిద్ధం చేయండి.",
            type = "BROADCAST",
            isManual = true
        )

        assertEquals("BROADCAST", broadcastMsg.type)
        assertTrue(broadcastMsg.isManual)
    }

    @Test
    fun testManualAdminMessageAndNotice() {
        val manualMsg = ReporterMessage(
            id = "manual_001",
            senderId = "real_admin_uid_99",
            senderName = "Chief Editor",
            senderRole = "ADMIN",
            text = "ప్రత్యేక పరిశీలన సూచనలు",
            type = "CHAT",
            isManual = true
        )
        assertTrue(manualMsg.isManual)

        val notice = AdminNotice(
            id = "notice_001",
            title = "ముఖ్య సందేశం",
            text = "విలేకరి కోసం వ్యక్తిగత సందేశం",
            senderName = "Chief Editor",
            senderRole = "ADMIN",
            type = "NOTICE",
            isManual = true
        )
        assertTrue(notice.isManual)
        assertEquals("Chief Editor", notice.senderName)
    }
}
