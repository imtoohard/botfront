/* eslint-disable react/prop-types */
import React from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import { sortBy, uniq } from 'lodash';
import moment from 'moment';
import {
    Tab, Message,
} from 'semantic-ui-react';

import { connect } from 'react-redux';
import ActivityInsertions from './ActivityInsertions';
import ActivityDataTable from './ActivityDataTable';
import ActivityActions from './ActivityActions';
import { Loading } from '../../utils/Utils';
import { ActivityCollection } from '../../../../api/activity';
import { NLUModels } from '../../../../api/nlu_model/nlu_model.collection';
import { getPureIntents } from '../../../../api/nlu_model/nlu_model.utils';
import { wrapMeteorCallback } from '../../utils/Errors';
import ConversationBrowser from '../../conversations/ConversationsBrowser';

class Activity extends React.Component {
    getDefaultState = () => ({ filterFn: utterances => utterances, activeTabIndex: undefined }); // eslint-disable-line react/sort-comp

    state = this.getDefaultState();

    createMenuItem = (name, index) => {
        const {
            model, projectId, params, replaceUrl,
        } = this.props;
        const { activeTabIndex } = this.state;
        const regexp = / /g;
        const urlId = name.toLowerCase().replace(regexp, '');
        const url = `/project/${projectId}/incoming/${model._id}/${urlId}`;
        if (activeTabIndex === undefined && params.tab === urlId) {
            this.setState({ activeTabIndex: index });
        }
        return {
            name,
            // active: params.tab === urlId,
            onClick: () => {
                // const url = `/project/${projectId}/model/${model._id}/${urlId}`;
                if (params.tab === urlId) return;
                replaceUrl({ pathname: url });
                this.setState({ activeTabIndex: index });
            },
        };
    }

    getPanes = () => {
        const {
            model, instance, project, params, replaceUrl,
        } = this.props;
        return [
            { menuItem: this.createMenuItem('Incoming', 0), render: this.renderIncomingTab },
            { menuItem: this.createMenuItem('Populate', 1), render: () => <ActivityInsertions model={model} instance={instance} /> },
            {
                menuItem: this.createMenuItem('Conversations', 2),
                render: () => <Tab.Pane><ConversationBrowser projectId={project._id} params={params} modelId={model._id} replaceUrl={replaceUrl} /></Tab.Pane>,
            },
            { menuItem: this.createMenuItem('Out of Scope', 3), render: () => <Tab.Pane>Out of Scope data</Tab.Pane> },
        ];
    }
    

    batchAdd = () => {
        const { modelId } = this.props;
        Meteor.call('activity.addValidatedToTraining', modelId, wrapMeteorCallback());
    };

    batchDelete = (modelId, itemIds) => {
        Meteor.call('activity.deleteExamples', modelId, itemIds, wrapMeteorCallback());
    };

    onEvaluate = () => {
        const { linkRender } = this.props;
        linkRender();
    };

    onValidateExamples = utterances => this.onExamplesEdit(utterances.map(e => ({ ...e, validated: !e.validated })));

    onExamplesEdit = (utterances, callback) => {
        Meteor.call('activity.updateExamples', utterances, wrapMeteorCallback(callback));
    };

    renderIncomingTab = () => {
        const {
            model: { _id: modelId },
            utterances,
            entities,
            intents,
            projectId,
            outDatedUtteranceIds,
            numValidated,
        } = this.props;

        const { filterFn } = this.state;
        const filteredExamples = filterFn(utterances);

        return utterances && utterances.length > 0 ? (
            <>
                <ActivityActions
                    onEvaluate={this.onEvaluate}
                    onDelete={() => this.batchDelete(modelId, filteredExamples.map(e => e._id))}
                    onAddToTraining={this.batchAdd}
                    onDone={() => this.setState(this.getDefaultState())}
                    onValidate={() => this.onValidateExamples(filteredExamples)}
                    numValidated={numValidated}
                    // eslint-disable-next-line no-shadow
                    onFilterChange={filterFn => this.setState({ filterFn })}
                    projectId={projectId}
                />
                <br />
                <ActivityDataTable
                    utterances={utterances}
                    entities={entities}
                    intents={intents}
                    projectId={projectId}
                    outDatedUtteranceIds={outDatedUtteranceIds}
                    modelId={modelId}
                />
            </>
        ) : (
            <Message success icon='check' header='Congratulations!' content='You are up to date' />
        );
    };

    selectInitialTab = () => {
        const { params } = this.props;
        const { activeTabIndex } = this.state;
        if (activeTabIndex === undefined && !params.tab) this.setState({ activeTabIndex: 0 });
    }

    render() {
        const { ready } = this.props;
        const { activeTabIndex } = this.state;
        this.selectInitialTab();
        return (
            <Loading loading={!ready}>
                <Tab
                    activeIndex={activeTabIndex}
                    menu={{ pointing: true, secondary: true }}
                    panes={this.getPanes()}
                />
            </Loading>
        );
    }
}

Activity.propTypes = {
    model: PropTypes.object.isRequired,
    utterances: PropTypes.array.isRequired,
    entities: PropTypes.array.isRequired,
    intents: PropTypes.array.isRequired,
    instance: PropTypes.object.isRequired,
    linkRender: PropTypes.func.isRequired,
    outDatedUtteranceIds: PropTypes.array.isRequired,
    params: PropTypes.object,
    replaceUrl: PropTypes.func.isRequired,
};

Activity.defaultProps = {
    params: {},
};

const ActivityContainer = withTracker((props) => {
    const {
        modelId, entities, intents, project,
    } = props;

    const isUtteranceOutdated = ({ training: { endTime } = {} }, { updatedAt }) => moment(updatedAt).isBefore(moment(endTime));
    const getOutdatedUtterances = (utterances, projectData) => utterances.filter(u => isUtteranceOutdated(projectData, u));

    const activityHandler = Meteor.subscribe('activity', modelId);
    const ready = activityHandler.ready();
    const model = NLUModels.findOne({ _id: modelId }, { fields: { 'training_data.common_examples': 1, training: 1, language: 1 } });
    const trainingExamples = model.training_data.common_examples;
    const pureIntents = getPureIntents(trainingExamples);
    const utterances = ActivityCollection.find({ modelId }, { sort: { createdAt: 1 } }).fetch();
    const outDatedUtteranceIds = getOutdatedUtterances(utterances, project).map(u => u._id);

    let localIntents = [];
    let localEntities = []; // eslint-disable-line
    let numValidated = 0;
    if (utterances) {
        localIntents = uniq(
            utterances
                .filter(e => !!e.intent)
                .map((e) => {
                    if (e.entities) {
                        e.entities.forEach((ent) => {
                            if (localEntities.indexOf(ent.entity) === -1) {
                                localEntities.push(ent.entity);
                            }
                        });
                    }

                    if (e.validated) {
                        numValidated += 1;
                    }

                    return e.intent.name || e.intent;
                }),
        );
    }
    return {
        model,
        pureIntents,
        utterances,
        outDatedUtteranceIds,
        ready,
        entities: uniq(entities.concat(localEntities)),
        intents: sortBy(uniq(intents.concat(localIntents))),
        numValidated,
    };
})(Activity);

const mapStateToProps = state => ({
    projectId: state.settings.get('projectId'),
});

export default connect(mapStateToProps)(ActivityContainer);
