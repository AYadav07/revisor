package com.ay.revisor.review;

import com.ay.revisor.course.CourseService;
import com.ay.revisor.shared.ConflictException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@Transactional
class ReviewServiceImpl implements ReviewService {

    private final LearningRecordRepository learningRecordRepository;
    private final ReviewLogRepository reviewLogRepository;
    private final ScheduleEntryRepository scheduleEntryRepository;
    private final CourseService courseService;

    ReviewServiceImpl(LearningRecordRepository learningRecordRepository, ReviewLogRepository reviewLogRepository,
                       ScheduleEntryRepository scheduleEntryRepository, CourseService courseService) {
        this.learningRecordRepository = learningRecordRepository;
        this.reviewLogRepository = reviewLogRepository;
        this.scheduleEntryRepository = scheduleEntryRepository;
        this.courseService = courseService;
    }

    @Override
    public LearnResponse learn(Long userId, Long subtopicId, Instant now, ZoneId userZone) {
        courseService.getSubtopic(userId, subtopicId);

        Optional<LearningRecord> existing = learningRecordRepository.findBySubtopicIdAndUserId(subtopicId, userId);
        if (existing.isPresent()) {
            LearningRecord record = existing.get();
            ScheduleEntry schedule = scheduleEntryRepository.findBySubtopicIdAndUserId(subtopicId, userId)
                    .orElseThrow();
            return new LearnResponse(subtopicId, record.getLearnedAt(), schedule.getNextReviewDate());
        }

        learningRecordRepository.save(new LearningRecord(subtopicId, userId, now));
        LocalDate nextReviewDate = LocalDate.ofInstant(now, userZone).plusDays(SM2Calculator.INITIAL_INTERVAL_DAYS);
        scheduleEntryRepository.save(new ScheduleEntry(subtopicId, userId, nextReviewDate));

        return new LearnResponse(subtopicId, now, nextReviewDate);
    }

    @Override
    public ReviewResponse review(Long userId, Long subtopicId, ReviewRequest request, Instant now, ZoneId userZone) {
        courseService.getSubtopic(userId, subtopicId);

        learningRecordRepository.findBySubtopicIdAndUserId(subtopicId, userId)
                .orElseThrow(() -> new ConflictException(
                        "Subtopic " + subtopicId + " has not been learned yet — call /learn first"));

        SM2Calculator.Sm2State previous = reviewLogRepository
                .findFirstBySubtopicIdAndUserIdOrderByReviewedAtDesc(subtopicId, userId)
                .map(log -> new SM2Calculator.Sm2State(log.getEaseFactor(), log.getIntervalDays(), log.getRepetitionCount()))
                .orElseGet(SM2Calculator::initialState);

        SM2Calculator.Sm2State next = SM2Calculator.next(request.quality(), previous);

        reviewLogRepository.save(new ReviewLog(subtopicId, userId, now, request.quality(),
                next.easeFactor(), next.intervalDays(), next.repetitionCount()));

        ScheduleEntry schedule = scheduleEntryRepository.findBySubtopicIdAndUserId(subtopicId, userId)
                .orElseThrow();
        LocalDate nextReviewDate = LocalDate.ofInstant(now, userZone).plusDays(next.intervalDays());
        schedule.setNextReviewDate(nextReviewDate);

        return new ReviewResponse(subtopicId, next.easeFactor(), next.intervalDays(), nextReviewDate,
                next.repetitionCount());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DueSubtopic> findDue(Long userId, LocalDate onOrBefore, Collection<Long> subtopicIds,
                                     Pageable pageable) {
        if (subtopicIds.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, 0);
        }
        return scheduleEntryRepository
                .findAllByUserIdAndNextReviewDateLessThanEqualAndSubtopicIdInOrderByNextReviewDateAscIdAsc(
                        userId, onOrBefore, subtopicIds, pageable)
                .map(entry -> new DueSubtopic(entry.getSubtopicId(), entry.getNextReviewDate()));
    }

    @Override
    @Transactional(readOnly = true)
    public Set<Long> findLearnedSubtopicIds(Long userId) {
        return new HashSet<>(learningRecordRepository.findSubtopicIdsByUserId(userId));
    }
}
