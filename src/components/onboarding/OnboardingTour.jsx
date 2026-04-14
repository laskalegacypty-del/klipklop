import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Joyride, ACTIONS, EVENTS, STATUS } from 'react-joyride'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const START_TUTORIAL_EVENT = 'start-onboarding-tutorial'

const BASE_STEPS = [
  {
    id: 'add-horse',
    target: '[data-tour="horses-add"]',
    route: '/horses',
    content: 'Start here: tap "Add horse" to create your first horse profile.',
  },
  {
    id: 'upload-photo',
    target: '[data-tour="horse-photo-upload"]',
    fallbackTarget: 'body',
    route: '/horses/:horseId',
    contentWithHorse: 'Open Details/Edit and use this button to upload a horse photo.',
    contentNoHorse: 'Next, upload a horse photo from a horse profile. Add a horse first, then open it and use the Upload photo button.',
    placementWithHorse: 'bottom',
    placementNoHorse: 'center',
  },
  {
    id: 'view-qualifiers',
    target: '[data-tour="qualifiers-view"]',
    route: '/qualifiers',
    content: 'This is where all qualifier events are listed in calendar/list/saved views.',
  },
  {
    id: 'bookmark-qualifier',
    target: '[data-tour="qualifier-bookmark"]',
    route: '/qualifiers',
    content: 'Use the star/bookmark action on an event to save it for quick access.',
  },
  {
    id: 'enter-times',
    target: '[data-tour="tracker-enter-times"]',
    route: '/tracker',
    content: 'Use Qualifier Tracker to select event + horse/rider combo, then enter and save your times.',
  },
]

function resolveRoutePath(step, firstHorseId) {
  if (step.route === '/horses/:horseId') {
    return firstHorseId ? `/horses/${firstHorseId}?tutorial=photo` : '/horses'
  }
  return step.route
}

export default function OnboardingTour() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, isAdmin, isSupporter, setHasSeenTutorial } = useAuth()
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [firstHorseId, setFirstHorseId] = useState(null)
  const [autoStartAttempted, setAutoStartAttempted] = useState(false)
  const routedStepIndexRef = useRef(-1)

  const canShowTutorial = profile && !isAdmin && !isSupporter

  useEffect(() => {
    if (!profile?.id || !canShowTutorial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFirstHorseId(null)
      return
    }

    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('horses')
        .select('id')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (active) setFirstHorseId(data?.id || null)
    })()

    return () => { active = false }
  }, [profile?.id, canShowTutorial])

  const steps = useMemo(() => {
    return BASE_STEPS.map(step => {
      if (step.id !== 'upload-photo') {
        return { ...step, content: step.content, routePath: resolveRoutePath(step, firstHorseId) }
      }
      const hasHorse = Boolean(firstHorseId)
      return {
        ...step,
        target: hasHorse ? step.target : step.fallbackTarget,
        content: hasHorse ? step.contentWithHorse : step.contentNoHorse,
        placement: hasHorse ? step.placementWithHorse : step.placementNoHorse,
        routePath: resolveRoutePath(step, firstHorseId),
      }
    })
  }, [firstHorseId])

  useEffect(() => {
    if (!canShowTutorial || run) return
    if (profile.has_seen_tutorial === false && !autoStartAttempted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex(0)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRun(true)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoStartAttempted(true)
    }
  }, [canShowTutorial, profile?.has_seen_tutorial, run, autoStartAttempted])

  useEffect(() => {
    const onStartTutorial = () => {
      if (!canShowTutorial) return
      routedStepIndexRef.current = -1
      setStepIndex(0)
      setRun(true)
    }

    window.addEventListener(START_TUTORIAL_EVENT, onStartTutorial)
    return () => window.removeEventListener(START_TUTORIAL_EVENT, onStartTutorial)
  }, [canShowTutorial])

  useEffect(() => {
    if (!run) return
    const activeStep = steps[stepIndex]
    if (!activeStep?.routePath) return
    if (routedStepIndexRef.current === stepIndex) return

    const targetPathname = activeStep.routePath.split('?')[0]
    if (location.pathname !== targetPathname) {
      navigate(activeStep.routePath)
    }
    routedStepIndexRef.current = stepIndex
  }, [run, stepIndex, steps, navigate, location.pathname])

  async function completeTutorial() {
    if (!profile || profile.has_seen_tutorial) return
    const { error } = await setHasSeenTutorial(true)
    if (error) {
      toast.error('Could not save tutorial state')
    }
  }

  async function handleJoyrideCallback(data) {
    const { action, index, status, type } = data

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false)
      setStepIndex(0)
      routedStepIndexRef.current = -1
      await completeTutorial()
      return
    }

    if (type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(prev => Math.min(prev + 1, steps.length - 1))
      return
    }

    if (type === EVENTS.STEP_AFTER) {
      const nextIndex = action === ACTIONS.PREV ? index - 1 : index + 1
      if (nextIndex >= 0 && nextIndex < steps.length) {
        setStepIndex(nextIndex)
      }
    }
  }

  if (!canShowTutorial) return null

  return (
    <Joyride
      run={run}
      steps={steps}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      spotlightClicks
      disableCloseOnEsc={false}
      disableOverlayClose
      scrollToFirstStep
      callback={handleJoyrideCallback}
      styles={{
        options: {
          zIndex: 12000,
          primaryColor: '#166534',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip',
      }}
    />
  )
}

export { START_TUTORIAL_EVENT }
